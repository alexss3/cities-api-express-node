module.exports.tokenAuth = (req, res, next) => {
  // Check the necessary auth headers are present
  const headers = req.headers;
  const authorization = headers['authorization'];

  // Validate the token
  if (!authorization || authorization !== `bearer ${process.env.TOKEN}`) {
    res.status(401).send('Missing or invalid authentication');
  } else {
    next();
  }
};
