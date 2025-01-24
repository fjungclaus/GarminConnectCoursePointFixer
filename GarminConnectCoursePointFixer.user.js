// ==UserScript==
// @name         GarminConnectCoursePointFixer
// @namespace    https://github.com/fjungclaus
// @version      0.9.5
// @description  Fix "distance along the track" of course points for imported GPX tracks containing waypoints. Garmin always puts a distance of "0" into the FIT files, which breaks the course point list (roadbook feature) on Garmin Edge devices ...
// @author       Frank Jungclaus, DL4XJ
// @license      GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// @match        https://connect.garmin.com/modern/course/edit/*
// @match        https://connect.garmin.com/modern/course/create-from-course/*
// @match        https://connect.garmin.com/modern/course/create*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

// todos
// - spend some screenshot about "how to use" for readme.md
// - allow to export course points as csv
// - find out how to inform react about changed data to get the "save"-button enabled

'use strict';


var $ = window.$; // just to prevent warnings about for jquery "$ not defined" in tampermonkey editor
var cps = null; // Quick'n'dirty: list of coursepoints to allow access this data in copyCoursePointNames()

/* CSS */
const CSS = `
table {
  border-collapse: collapse;
  width: 1200px;
}
td, th {
  border: 1px dashed #000;
  padding: 0.5rem;
  text-align: left;
}`;

// GM_addStyle() does no longer work with GreaseMonkey, so ...
// see http://greasemonkey.win-start.de/patterns/add-css.html
function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}

// FindReact taken from: https://stackoverflow.com/a/39165137/978756
function FindReact(dom, traverseUp = 0) {
    const key = Object.keys(dom).find(key=>{
        return key.startsWith("__reactFiber$") // react 17+
            || key.startsWith("__reactInternalInstance$"); // react <17
    });
    const domFiber = dom[key];
    if (domFiber == null) return null;

    // react <16
    if (domFiber._currentElement) {
        let compFiber = domFiber._currentElement._owner;
        for (let i = 0; i < traverseUp; i++) {
            compFiber = compFiber._currentElement._owner;
        }
        return compFiber._instance;
    }

    // react 16+
    const GetCompFiber = fiber=>{
        //return fiber._debugOwner; // this also works, but is __DEV__ only
        let parentFiber = fiber.return;
        while (typeof parentFiber.type == "string") {
            parentFiber = parentFiber.return;
        }
        return parentFiber;
    };
    let compFiber = GetCompFiber(domFiber);
    for (let i = 0; i < traverseUp; i++) {
        compFiber = GetCompFiber(compFiber);
    }
    return compFiber.stateNode;
}

function FindNearest(gps, cp) {
    let min = 999999999;
    let minIdx = 0;

    for(let i= 0; i < gps.length; i++) {
        let x = gps[i].longitude - cp.lon;
        let y = gps[i].latitude - cp.lat;
        let dst = x * x + y * y;

        if (dst < min) {
            min = dst;
            minIdx = i;
        }
    }

    return gps[minIdx];
}

function getElementByXpath(path) {
  return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function copyCoursePointNames() {
    if (cps && cps.length) {
        for(let i = 0; i < cps.length; i++) {
            var cp = cps[i];
            var cb = $("input#gcpf_cp_name_cb_" + i);
            var newName = $("input#gcpf_cp_name_input_" + i).val().trim();

            if (newName && newName.length) {
                console.log(i + ': checked=' + cb[0].checked + ': current-name=' + cp.name + '/ new-name=' + newName);
                if (cb[0].checked) {
                    cp.name = newName;
                }
            }
        }
    }
}

function inputChange(idx,e) {
    console.log("inputChange: " + idx + ":value=" + e.target.value);
    var cb = $("input#gcpf_cp_name_cb_" + idx);
    cb[0].checked = true;
}

function dbgGetXPath(element) {
    let path = '';
    while (element) {
        const tagName = element.tagName.toLowerCase();
        let index = 0;
        let sibling = element.previousElementSibling;

        while (sibling) {
            if (sibling.tagName.toLowerCase() === tagName) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }

        path = `${tagName}${index ? `[${index + 1}]` : ''}${path ? '/' + path : ''}`;
        element = element.parentElement;
    }
    return '/' + path;
}

function FixIt() {
    const mainBody = document.querySelector("body > div > div.main-body");
    const mainBodyDivs = mainBody.querySelectorAll("div");
    var rData = null;

    // Poking around in the dark to find the react props we're interested in ...
	for(var i = 0; i < mainBodyDivs.length; i++) {
        var x = FindReact(mainBodyDivs[i], 2);
     
		if (x == null || x.props == null || x.props.editableCourseDetails == null) {
            continue;
        }
        
		console.log("Found editableCourseDetails @offset " + i + "/" + mainBodyDivs.length + ", XPath=" + dbgGetXPath(mainBodyDivs[i]));
        rData = x;
        break;
    }

    if (rData) {
        var ecd = rData.props.editableCourseDetails;
        cps = ecd.coursePoints;
        var gps = ecd.geoPoints;

        if (cps && cps.length) {
            var dialogTxt;
            dialogTxt += '<div id="dbgDialog" title="DEBUG: Garmin Connect Course-Point Fixer ...">';
            dialogTxt += '<b>' + ecd.courseName + '</b> with ' + cps.length + ' course points:';
            dialogTxt += '<table>';
            dialogTxt += '<tr><th>#</th><th>Created<br>Modified</th><th>Type</th><th>Name (max. 15 chars!)</th><th>Lat [&deg;]</th><th>Lon [&deg;]</th><th>Orig. Elev. [m]</th><th>Corr. elev. [m]</th><th>Orig. Dist [m]</th><th>Corr. Dist. [m]</th><tr>';

            for(let i = 0; i < cps.length; i++) {
                var cp = cps[i];
                var nearest = FindNearest(gps, cp);
                dialogTxt += "<tr>";
                dialogTxt += "<td>" + i + "</td>";
                dialogTxt += "<td>" + cp.createdDate + "<br>" + cp.modifiedDate + "</td>";
                dialogTxt += "<td>" + cp.coursePointType + "</td>";
                dialogTxt += '<td>';
                dialogTxt += ' <input type="text" id="gcpf_cp_name_input_' + i + '" size="16" maxlength="15" autocomplete="off" spellcheck="false" value="' + cp.name + '"/>&nbsp;';
                dialogTxt += ' <input title="Check to copy new name!" type="checkbox" id="gcpf_cp_name_cb_' + i + '"/>';
                dialogTxt += '</td>';
                dialogTxt += "<td>" + cp.lat.toFixed(8) + "</td>";
                dialogTxt += "<td>" + cp.lon.toFixed(8) + "</td>";
                dialogTxt += "<td>" + cp.elevation.toFixed(1) + "</td>";
                dialogTxt += "<td>" + nearest.elevation.toFixed(1) + "</td>";
                dialogTxt += "<td>" + cp.distance.toFixed(1) + "</td>";
                dialogTxt += "<td>" + nearest.distance.toFixed(1) + "</td>";
                dialogTxt += "</tr>";
                // Fix it ...
                cp.distance = nearest.distance;
                cp.elevation = nearest.elevation;
            }

            dialogTxt += '</table></div>';

            $("body").append(dialogTxt);
            $("#dbgDialog").dialog({
                autoOpen: false,
                maxHeight: 640,
                width: 1260, maxWidth: 1260,
                closeText: "Close the Debug Dialog and save changes!",
                close: function() { copyCoursePointNames() },
                buttons: {
                    "Save+Close": function() { copyCoursePointNames(); $(this).dialog('close'); },
                }
            });
            $("#dbgDialog").dialog('open');

            for (let i = 0; i < cps.length; i++) {
                var inp = $("input#gcpf_cp_name_input_" + i);
                inp[0].addEventListener('input', (evt) => inputChange(i,evt));
            }

            // Prepend "F:" to course name to show this is a "fixed" variant of the course ...
            ecd.courseName = "F:" + ecd.courseName;

        } else {
            alert("Sorry ... no course points ...");
        }
    } else {
        alert("Sorry ... No react props with editableCourseDetails found ... :(");
    }
}

(function() {
    addGlobalStyle(CSS);
    GM_registerMenuCommand("Fix it", FixIt, "f");
    console.log("*** Added GarminConnectCoursePointFixer to context menu ...");
})();
