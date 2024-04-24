# GarminConnectCoursePointFixer
GarminConnect: Fix "distance along the track" of course points for imported GPX tracks containing waypoints. Garmin always puts a distance of "0" into the FIT files, which breaks the course point list (roadbook feature) on Garmin Edge devices ...

# Changelog
- 2024/04/25, 0.9.3
  - Automatically set the checkbox if a course point name has been changed
  
- 2024/04/24, 0.9.2
  - Added jQuery dialog with debug output
  - Allow to change the names of course points
  
- 2024/04/24, 0.9.1
  - Search for the react properties we are interested in by means of a xpath. The previously used name of the selector changed too often ;)
