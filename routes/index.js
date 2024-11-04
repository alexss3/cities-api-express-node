const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const dataLib = require('../lib/data');
const uuid = require('uuid');

router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.get('/cities-by-tag', (req, res) => {
  const tags = req.query.tag ?? null;
  const isActive = req.query.isActive ?? null;

  if (tags !== null) {
    // Prepare our tags and filters
    const trimmedTags = tags.split(',').map((tag) => tag.trim());
    // Call a helper function to find matching addresses
    const cities = dataLib.filterByTagAndIsActive(trimmedTags, isActive);
    
    res.json({
      cities
    });
  } else {
    res.status(401).send('No tags were provided. Use the /all-cities endpoint instead');
  }
});

router.get('/distance', (req, res) => {
  const from = req.query.from ?? null;
  const to = req.query.to ?? null;

  // Test that from and to are valid guids
  const isFromValid = uuid.validate(from);
  const isToValid = uuid.validate(to);

  if (!isFromValid || !isToValid) {
    const msg = "Invalid id supplied for 'from' or 'to'";
    res.send(msg);
  } else {
    const result = dataLib.getDistanceBetweenCities(from, to);
    res.json(result);
  }
});

router.get('/area', async (req, res) => {
  const from = req.query.from ?? null;
  const distance = req.query.distance ?? null;
  const isFromValid = uuid.validate(from);

  if (!from || !isFromValid || !distance) {
    const msg = 'One or more required parameters missing';
    res.send(msg);
  } else {

    console.log(typeof(distance));
    // Check that distance is at least 1 km
    if (!Number.isInteger(Number(distance))) {
      console.log('hey');
      res.status(401).send('Distance must be an integer');
    } else if (distance < 1) {
      res.status(401).send('Distance must be 1km or greater');
    // Also check it doesn't exceed the earth's circumference
    // (around the equator is a bit larger than pole-to-pole, so use the former)
    } else if (distance > 40075) {
      res.status(401).send("Distance (in kilometers) cannot exceed the earth's circumference");
    } else {
      // Create a new GUID to store the results of the operation
      // const newGuid = uuid.v4();
      const newGuid = '2152f96f-50c7-4d76-9e18-f7033bd14428';

      // Create a new file in .data/radiusLookups
     const data = await dataLib.createRadiusLookup(from, Number(distance), newGuid);
      
      await dataLib.performRadiusLookup(data.addressObject, distance, newGuid);
      res.status(202).json({
        resultsUrl: `http://${process.env.HOST}:${process.env.PORT}/area-result/${newGuid}`,
      });
    }
  }
});

router.get('/area-result/:guid', async (req, res) => {
  const guid = req.params.guid;

  if (uuid.validate(guid)) {
    // look up by guid
    const result = await dataLib.readFile('radiusLookups', guid);

    if (result.status === 'complete') {
      res.status(200).json(result);
    } else {
      res.status(202).json(result);
    }
   
  } else {
    res.status(401).send('Invalid guid supplied');
  }
});

router.get('/all-cities', (req, res) => {
  // Use a stream to send the data
  const readStream = fs.createReadStream(path.join(__dirname, '/../.data/addresses/addresses.json'), {
    encoding: 'utf-8'
  });

  readStream.on('error', (err) => {
    res.send('Failed to load address data');
  });

  // Pipe the stream output to the response object
  readStream.pipe(res);
});

module.exports = router;
