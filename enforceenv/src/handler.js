// libraries
const express    = require('express'),
      fs         = require('fs'),
      request    = require('request');

// api url, CA and authorization token
const apiCA    = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt', 'utf8'),
      apiUrl   = `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`,
      apiToken = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');

// router instance
var router = express.Router();

// get namespace from API
function getNamespace(name, callback) {
  request.get({
    ca: apiCA,
    url: `${apiUrl}/api/v1/namespaces/${name}`,
    json: true,
    headers: {'Authorization': `Bearer ${apiToken}` }
  }, (err, res, data) => {
    if (err || res.statusCode !== 200) {
      console.log(res);
      callback(`Error when retrieving data for ${name} namespace.`, null);
    } else {
      callback(null, data);
    }
  });
}

// process POST
router.post('/', (req, res) => {
  // set the proper header
  res.setHeader('Content-Type', 'application/json');

  // query to API to read namespace labels and loop over all env array
  getNamespace(req.body.request.namespace, (err, data) => {
    if (err) {
      console.log(err);
      res.send(err).status(500).end();
    }
    else {
      // check for annotation existance to read env vars
      if (data.metadata.annotations['enforceenv.admission.online.openshift.io/env']) {
        // parse JSON from the annotations in the namespace
        var env = JSON.parse(data.metadata.annotations['enforceenv.admission.online.openshift.io/env']);
        // convert the env array to a dictionary
        console.log(req.body.request);
        var podenv = req.body.request.object.spec.containers[0].env.reduce((map, obj) => {
                   map[obj.name] = obj.value;
                   return map;
                 }, {});

        // merge both dictionaries and convert the result into an array
        Object.assign(env, podenv);
        podenv = JSON.stringify(Object.keys(env).map((key) => {
          return {name: key, value: env[key]};
        }));
        
        // generate patch
        var jsonPatch='{"op": "replace", "path": "/object/spec/containers/0/env", "value": '+podenv+'}';
        console.log(jsonPatch);

        // TODO: generate the admissionResponse object and return it
        var admissionResponse = {
          response: {
            uid: req.body.request.uid,
            allowed: true,
            patch: jsonPatch
          }
        };
        console.log(admissionResponse);
        res.send(JSON.stringify(admissionResponse));
      }
      res.status(200).end();
    }
  });
});

// module export
module.exports = router;
