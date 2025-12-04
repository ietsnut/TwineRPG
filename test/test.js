var expect = require("chai").expect;
var fs = require("fs");
require("jsdom-global")();

var story;

describe("Converting to JSON", function () {
  beforeEach(function () {
    document.body.innerHTML = "";
  });

  it("should generate the correct JSON", function () {
    var storyData = fs.readFileSync("fixture.html", "utf-8");
    var div = document.createElement("div");
    div.innerHTML = storyData;
    story = div.childNodes[0];
    document.body.appendChild(story);

    var output = document.createElement("div");
    output.setAttribute("id", "output");
    document.body.appendChild(output);

    var expected = fs.readFileSync("output.json", "utf-8");

    require("../src/twison.js");

    window.Twison.convert(story);
    var result = document.querySelector("#output pre").textContent;

    expect(JSON.parse(result)).to.deep.equal(JSON.parse(expected));
  });

  it("should generate the correct JSON for RPG Maker format", function () {
    var storyData = fs.readFileSync("fixture_rpg.html", "utf-8");
    var div = document.createElement("div");
    div.innerHTML = storyData;
    story = div.childNodes[0];
    document.body.appendChild(story);

    var output = document.createElement("div");
    output.setAttribute("id", "output");
    document.body.appendChild(output);

    var expected = fs.readFileSync("output_rpg.json", "utf-8");

    window.Twison.convert(story);
    var result = document.querySelector("#output pre").textContent;

    expect(JSON.parse(result)).to.deep.equal(JSON.parse(expected));
  });
});
