var Twison = {

  /**
   * Extract the link entities from the provided text.
   *
   * Text containing [[foo]] would yield a link named "foo" pointing to the
   * "foo" passage.
   *
   * @param {String} text
   *   The text to examine.
   *
   * @return {Array|null}
   *   The array of link objects, containing a `name` and `condition`.
   */
  extractLinksFromText: function (text) {
    var links = text.match(/\[\[.+?\]\]/g);
    if (!links) {
      return null;
    }

    return links.map(function (link) {
      var linkObj = {};
      var content = link.substring(2, link.length - 2);

      // Check for condition: [[condition | link]]
      // We look for the first pipe | to separate condition from link
      var pipeIndex = content.indexOf('|');
      if (pipeIndex !== -1) {
        linkObj.condition = content.substring(0, pipeIndex).trim();
        content = content.substring(pipeIndex + 1).trim();
      }

      // We assume name and link are the same, so we only store name.
      // If there is a ->, we take the target (right side) as the name.
      var differentName = content.match(/(.*?)\->(.*)/);
      if (differentName) {
        // [[alias->target]] -> name: target
        linkObj.name = differentName[2].trim();
      } else {
        // [[link]] -> name: link
        linkObj.name = content.trim();
      }
      return linkObj;
    });
  },

  /**
   * Extract the prop entities from the provided text.
   *
   * A provided {{foo}}bar{{/foo}} prop would yield an object of `{"foo": 'bar'}`.
   * Nested props are supported by nesting multiple {{prop}}s within one
   * another.
   *
   * @param {String} text
   *   The text to examine.
   *
   * @return {Object|null}
   *   An object containing all of the props found.
   */
  extractPropsFromText: function (text) {
    var props = {};
    var propMatch;
    var matchFound = false;
    const propRegexPattern = /\{\{((\s|\S)+?)\}\}((\s|\S)+?)\{\{\/\1\}\}/gm;

    while ((propMatch = propRegexPattern.exec(text)) !== null) {
      // The "key" of the prop, AKA the value wrapped in {{ }}.
      const key = propMatch[1];

      // Extract and sanitize the actual value.
      // This will remove any new lines.
      const value = propMatch[3].replace(/(\r\n|\n|\r)/gm, '');

      // We can nest props like so: {{foo}}{{bar}}value{{/bar}}{{/foo}},
      // so call this same method again to extract the values further.
      const furtherExtraction = this.extractPropsFromText(value);

      if (furtherExtraction !== null) {
        props[key] = furtherExtraction;
      } else {
        props[key] = value;
      }

      matchFound = true;
    }

    if (!matchFound) {
      return null;
    }

    return props;
  },

  /**
   * Convert an entire passage.
   *
   * @param {Object} passage
   *   The passage data HTML element.
   *
   * @return {Object}
   *   Object containing specific passage data. Examples include `name`, `pid`,
   *   `position`, etc.
   */
  convertPassage: function (passage) {
    // Use innerHTML to preserve tags like <wobbly>
    var dict = { text: passage.innerHTML };

    // Extract metadata
    var lines = dict.text.split(/\r?\n/);
    var metadata = {};
    var variables = {};
    var contentStartIndex = 0;
    var foundMetadata = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === "") {
        if (foundMetadata) {
          contentStartIndex = i + 1;
          break;
        } else {
          // Skip leading empty lines
          continue;
        }
      }

      // Metadata regex: Key: Value
      var match = line.match(/^([A-Za-z0-9_ ]+):\s*(.*)$/);
      if (match) {
        var key = match[1].toLowerCase();
        var value = match[2];

        if (key === "variable") {
          // Variable: health - 10
          // Regex: ([^=\s]+)\s+(.+)
          // We want to capture the rest of the line as the value, including operators like - or +
          var varMatch = value.match(/([^=\s]+)\s+(.+)/);
          if (varMatch) {
            variables[varMatch[1]] = varMatch[2];
          }
        } else if (key === "type") {
          dict.type = value;
        } else {
          metadata[key] = value;
        }
        foundMetadata = true;
      } else {
        // If a line doesn't match metadata format, assume end of metadata
        contentStartIndex = i;
        break;
      }
    }

    if (Object.keys(metadata).length > 0) {
      dict.metadata = metadata;
    }
    if (Object.keys(variables).length > 0) {
      dict.variables = variables;
    }

    // Reconstruct text without metadata
    dict.text = lines.slice(contentStartIndex).join("\n");

    // Sanitize text: remove << ... >>
    dict.text = dict.text.replace(/<<.*?>>/g, "");

    // Sanitize text: remove [[ ... ]]
    dict.text = dict.text.replace(/\[\[.*?\]\]/g, "");

    // Helper to decode HTML entities
    function decodeEntities(encodedString) {
      var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
      var translate = {
        "nbsp": " ",
        "amp": "&",
        "quot": "\"",
        "lt": "<",
        "gt": ">"
      };
      return encodedString.replace(translate_re, function (match, entity) {
        return translate[entity];
      });
    }

    // Decode entities in the text content
    dict.text = decodeEntities(dict.text);

    var links = Twison.extractLinksFromText(passage.innerHTML); // Use original HTML for link extraction before stripping
    // Wait, we need to extract links from the text BEFORE stripping them from dict.text?
    // Actually, extractLinksFromText uses regex on the text.
    // If we strip them from dict.text, we can't extract them from dict.text.
    // But we need to extract them from the original text (or at least the text with links).
    // However, we also need to respect the metadata stripping.
    // So let's extract links from the text AFTER metadata stripping but BEFORE link stripping.

    // Let's re-order:
    // 1. Extract metadata
    // 2. Get text without metadata
    // 3. Extract links from this text
    // 4. Strip links from this text
    // 5. Decode entities

    // Re-doing the logic flow:

    // 1. Reconstruct text without metadata
    var textWithLinks = lines.slice(contentStartIndex).join("\n");

    // 2. Decode entities for link extraction (Twine encodes > as &gt;)
    textWithLinks = decodeEntities(textWithLinks);

    // 3. Extract links
    var links = Twison.extractLinksFromText(textWithLinks);
    if (links) {
      dict.links = links;
    }

    // 4. Sanitize text: remove << ... >>
    dict.text = textWithLinks.replace(/<<.*?>>/g, "");

    // 5. Sanitize text: remove [[ ... ]]
    dict.text = dict.text.replace(/\[\[.*?\]\]/g, "");

    const props = Twison.extractPropsFromText(dict.text);
    if (props) {
      dict.props = props;
    }

    ["name", "pid", "tags"].forEach(function (attr) {
      var value = passage.attributes[attr].value;
      if (value) {
        dict[attr] = value;
      }
    });

    if (dict.tags) {
      dict.tags = dict.tags.split(" ");
    }

    return dict;
  },

  /**
   * Convert an entire story.
   *
   * @param {Object} story
   *   The story data HTML element.
   *
   * @return {Object}
   *   Object containing processed "passages" of data.
   */
  convertStory: function (story) {
    var passages = story.getElementsByTagName("tw-passagedata");
    var convertedPassages = Array.prototype.slice.call(passages).map(Twison.convertPassage);

    var dict = {
      passages: convertedPassages
    };

    ["name", "startnode", "creator", "creator-version", "ifid"].forEach(function (attr) {
      var value = story.attributes[attr].value;
      if (value) {
        dict[attr] = value;
      }
    });

    // Add PIDs to links
    var pidsByName = {};
    dict.passages.forEach(function (passage) {
      pidsByName[passage.name] = passage.pid;
    });

    dict.passages.forEach(function (passage) {
      if (!passage.links) return;
      passage.links.forEach(function (link) {
        link.pid = pidsByName[link.name]; // Link field removed, use name
        if (!link.pid) {
          link.broken = true;
        }
      });
    });

    return dict;
  },

  /**
   * The entry-point for converting Twine data into the Twison format.
   */
  convert: function () {
    var storyData = document.getElementsByTagName("tw-storydata")[0];
    var jsonStr = JSON.stringify(Twison.convertStory(storyData), null, 2);

    var container = document.getElementById("output");
    container.innerHTML = ""; // Clear existing content

    // Create Download Button
    var btn = document.createElement("button");
    btn.innerHTML = "Download JSON";
    btn.onclick = function () {
      var blob = new Blob([jsonStr], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "story.json";
      a.click();
    };
    container.appendChild(btn);

    // Create Pre element for JSON display
    var pre = document.createElement("pre");
    pre.textContent = jsonStr;
    container.appendChild(pre);
  }
}

window.Twison = Twison;