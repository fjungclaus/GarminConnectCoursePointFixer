// ==UserScript==
// @name         GarminConnectCoursePointFixer
// @namespace    https://github.com/fjungclaus
// @version      0.9.0
// @description  Fix "distance along the track" of course points for imported GPX tracks containing waypoints. Garmin always puts a distance of "0" into the FIT files, which breaks the course point list (roadbook feature) on Garmin Edge devices ...
// @author       Frank Jungclaus, DL4XJ
// @license      GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// @match        https://connect.garmin.com/modern/course/edit/*
// @match        https://connect.garmin.com/modern/course/create-from-course/*
// @match        https://connect.garmin.com/modern/course/create*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

// todos
// - spend an information window by means of jquery
// - allow to export course points as csv
// - find out how to inform react about changed data to get the "save"-button enabled

'use strict';

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

function FixIt() {
    var rElem = document.querySelector("body > div > div.main-body > div.content.page.Course_course__3mkS5 > div");

    if (rElem == null) {
        alert("Can't find element 'Course_course__3mkS5' :(");
        return;
    }

    var rData = FindReact(rElem, 2);
    if (rData) {
        var ecd = rData.props.editableCourseDetails;
        var cps = ecd.coursePoints;
        var gps = ecd.geoPoints;

        if (cps && cps.length) {
            for(let i = 0; i < cps.length; i++) {
                var cp = cps[i];
                var nearest = FindNearest(gps, cp);
                console.log("name=" + cp.name + ", lat=" + cp.lat + ", lon=" + cp.lon + ", dist=" + cp.distance + "m, fixed distance=" + nearest.distance.toFixed(1) + "m");
                // Fix it ...
                cp.distance = nearest.distance;
                cp.elevation = nearest.elevation;
            }

            // Prepend "F:" to course name to show this is a "fixed" variant of the course ...
            ecd.courseName = "F:" + ecd.courseName;

        } else {
            alert("Sorry ... no course points ...");
        }
    } else {
        alert("Can't access react data :(");
    }
}

(function() {
    GM_registerMenuCommand("Fix it", FixIt, "f");
})();