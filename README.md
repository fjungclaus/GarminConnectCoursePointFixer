# GarminConnectCoursePointFixer
GarminConnect: Fix "distance along the track" of course points for imported GPX tracks containing waypoints. Garmin always puts a distance of "0" into the FIT files, which breaks the course point list (roadbook feature) on Garmin Edge devices ...

# Changelog
- 04/24/2024, 0.9.1
  Search for the react properties we are interested in by means of a xpath. The previously used name of the selector changed too often ;)
