const helpers = {};

// Credit goes to Chris Veness for the formula and javascript
// https://www.movable-type.co.uk/scripts/latlong.html
helpers.haversineFormula = (fromLatitude, fromLongitude, toLatitude, toLongitude) => {
  const R = 6371e3; // meters
  const φ1 = fromLatitude * Math.PI/180; // φ, λ in radians
  const φ2 = toLatitude * Math.PI/180;
  const Δφ = (toLatitude-fromLatitude) * Math.PI/180;
  const Δλ = (toLongitude-fromLongitude) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distanceInMeters = R * c; // in meters

  return distanceInMeters;
};

// https://www.movable-type.co.uk/scripts/latlong-db.html
helpers.boundingCircle = (lat, lon, radius, points) => {
  const R = 6371e3; // earth's mean radius in meters
  const sin = Math.sin, cos = Math.cos, acos = Math.acos;
  const pi = Math.PI;

  const radiusInMeters = radius * 1000;

  const params = {
    minLat: lat - radiusInMeters / R * 180 / pi,
    maxLat: lat + radiusInMeters / R * 180 / pi,
    minLon: lon - radiusInMeters / R * 180 / pi / cos(lat * pi / 180),
    maxLon: lon + radiusInMeters / R * 180 / pi / cos(lat * pi / 180),
  };

  const pointsBoundingBox = points.filter((point) => {
    return point.latitude >= params.minLat && point.latitude <= params.maxLat
      && point.longitude >= params.minLon && point.longitude <= params.maxLon;
  });

  
  // add in distance d = acos( sinφ₁⋅sinφ₂ + cosφ₁⋅cosφ₂⋅cosΔλ ) ⋅ R
  pointsBoundingBox.forEach((p) => {
    p.d = acos(sin(p.latitude * pi / 180) * sin(lat * pi / 180) + cos(p.latitude * pi / 180) * cos(lat * pi / 180) * cos(p.longitude * pi / 180 - lon * pi / 180)) * R;
  });
    
  // filter for points with distance from bounding circle centre less than radius, and sort
  const pointsWithinCircle = pointsBoundingBox.filter(p => p.d < radiusInMeters).sort((a, b) => a.d - b.d);

  return pointsWithinCircle;
}

module.exports = helpers;