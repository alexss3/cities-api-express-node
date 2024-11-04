const fsp = require('node:fs/promises');
const path = require('path');
const helpers = require('./helpers');
const _performance = require('perf_hooks').performance;
const util = require('util');
const debug = util.debuglog('performance');

const lib = {};

lib.addresses = [];

lib.baseDir = path.join(__dirname, '/../.data/');

lib.loadAddressData = async () => {
  _performance.mark('Begin loading address data from disk');
  try {
    const data = await fsp.readFile(`${lib.baseDir}addresses/addresses.json`, 'utf-8');
    _performance.mark('Data loaded from json file');

    lib.addresses = JSON.parse(data);
    
    const measurement = _performance.measure('Time to load file', 'Begin loading address data from disk', 'Data loaded from json file');
    debug(`${measurement.name} ${measurement.duration}`);
  } catch (error) {
    res.status(500).send(error);
  }
};

lib.readFile = async (dir, file) => {
  try {
    const data = await fsp.readFile(`${lib.baseDir}${dir}/${file}.json`, {
      encoding: 'utf-8'
    });
    return JSON.parse(data);
  } catch (error) {
    res.status(500).send(error);
  }
};

lib.createRadiusLookup = async (from, distance, guid) => {

  let filehandle;

  try {
    filehandle = await fsp.open(`${lib.baseDir}/radiusLookups/${guid}.json`, 'w');
    
    const initialData = {
      guid,
      from,
      distance,
      status: 'in progress',
      cities: [],
    };
    
    _performance.mark('Create radius lookup');

    const matchedAddress = lib.addresses.find((address) => address.guid === from);

    _performance.mark('Found matching address');

    await fsp.writeFile(filehandle, JSON.stringify(initialData), { encoding: 'utf-8' });
    
    _performance.mark('Lookup file created');

    _performance.measure('Start to found matching address', 'Create radius lookup', 'Found matching address');
    _performance.measure('Found address to file created', 'Found matching address', 'Lookup file created');

    const measurements = _performance.getEntriesByType('measure');
    measurements.forEach((measurement) => debug(`${measurement.name} ${measurement.duration}`));

    return { ...initialData, addressObject: matchedAddress };

  } catch (error) {
    console.log(error);
  } finally {
    await filehandle.close();
  }
};

lib.performRadiusLookup = async (from, distance, guid) => {
  _performance.mark('Start radius lookup');
  
  let filehandle;
  try {
    filehandle = await fsp.open(`${lib.baseDir}/radiusLookups/${guid}.json`, 'r+');

    _performance.mark('Lookup file opened');

    _performance.mark('Begin finding matching cities');
    
    // Bounding circle helper - CPU intensive operation
    const matchingCities = helpers.boundingCircle(from.latitude, from.longitude, distance, lib.addresses);
    
    _performance.mark('Found all matching cities');

    const result = {
      guid,
      from,
      distance,
      status: 'complete',
      // Remove the address used as the center point of the bounding circle
      cities: matchingCities.filter((address) => address.guid !== from.guid),
    };

    _performance.mark('Built result object');

    await filehandle.truncate();
    _performance.mark('Truncated output file');

    await filehandle.writeFile(JSON.stringify(result));
    _performance.mark('Result written to file');

  } catch (error) {
    res.status(500).send(error);
  } finally {
    filehandle.close();

    _performance.mark('Radius lookup complete');

    _performance.measure('Start to opening lookup file', 'Start radius lookup', 'Lookup file opened');
    _performance.measure('Time to find matching cities', 'Begin finding matching cities', 'Found all matching cities');
    _performance.measure('Truncated file and wrote new result', 'Truncated output file', 'Result written to file');
    _performance.measure('Total time start to finish', 'Start radius lookup', 'Radius lookup complete');

    const measurements = _performance.getEntriesByType('measure');
    measurements.forEach((measurement) => debug(`${measurement.name} ${measurement.duration}`));

  }
};

// We have to loop through ALL addresses
lib.filterByTagAndIsActive = (tags, isActive) => {
  const matchedAddresses = [];

  const isActiveBoolean = typeof(isActive) == 'string' && isActive === 'true' 
    ? true
    : false;

  _performance.mark('Start filter by tag');

  lib.addresses.forEach((address) => {
    // Loop through each provided tag
    tags.forEach((tag) => {
      // Does it contain this tag?
      if (address.tags.indexOf(tag) > -1) {
        // Is the isActive flag set, if not the address has matched based on tag
        if (isActive !== null ) {
          // Test if the isActive flag matches
          if (address.isActive === isActiveBoolean) {
            matchedAddresses.push(address);
          }
        } else {
          matchedAddresses.push(address);
        }
      }
    });
  });

  _performance.mark('Found all matching addresses');

  const measurement = _performance.measure('Total time to filter by tag', 'Start filter by tag', 'Found all matching addresses');

  debug(`${measurement.name} ${measurement.duration}`);

  return matchedAddresses;
};

lib.getDistanceBetweenCities = (from, to) => {
  // Loop through the array of addresses to find the matching
  // addresses.

  // Performance concerns: 
  // We could loop once, but we might have to scan the entire array
  // If we do an Array.find() for each, that's two loops BUT they will
  // stop when they find the address. Worst case is that both are the last
  // two elements in the array, best case they are the first two.

  _performance.mark('Begin finding distance between two addresses');

  const fromAddress = lib.addresses.find((address) => address.guid === from);
  _performance.mark('Found from address');
  const toAddress = lib.addresses.find((address) => address.guid === to);
  _performance.mark('Found to address');

  if (!fromAddress || !toAddress) {
    res.status(401).send('From or To missing');
  } else {
    // Calculate the distance between these two points
    _performance.mark('Begin distance calculation');
    const distance = Number((helpers.haversineFormula(
      fromAddress.latitude,
      fromAddress.longitude,
      toAddress.latitude,
      toAddress.longitude
    ) / 1000).toFixed(2));

    _performance.mark('Distance calculated');

    _performance.measure('Start to finding from address', 'Begin finding distance between two addresses', 'Found from address');
    _performance.measure('From address found to finding to address', 'Found from address', 'Found to address');
    _performance.measure('Time to calculate distance between addresses', 'Begin distance calculation', 'Distance calculated');

    const measurements = _performance.getEntriesByType('measure');
    measurements.forEach((measurement) => debug(`${measurement.name} ${measurement.duration}`));
    
    return {
      from: fromAddress,
      to: toAddress,
      unit: 'km', // FR: make the unit an optional param
      distance,
    };
  }
};

module.exports = lib;