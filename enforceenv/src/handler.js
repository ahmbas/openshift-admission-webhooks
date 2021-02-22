// libraries
const base64 = require('js-base64').Base64;

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
  console.log(req.body);
  res.setHeader('Content-Type', 'application/json');

  // query to API to read namespace labels and loop over all env array
  getNamespace(req.body.request.namespace, (err, data) => {
    if (err) {
      console.log(err);
      res.send(err).status(500).end();
    }
    else {
        // generate patch
        //var jsonPatch='{"op": "add", "path": "/object/metadata/labels/hello", "value": "world"}';
        let jsonPatch = [{
          op: "replace",
          path: "/spec/containers/0/image",
          value: "debian"
        }]
        console.log(jsonPatch);

        // TODO: generate the admissionResponse object and return it
        var admissionResponse = {
          response: {
            uid: req.body.request.uid,
            allowed: true,
            patch: base64.encode(JSON.stringify(jsonPatch))
          }
        };
        console.log(admissionResponse);
        res.send(JSON.stringify(admissionResponse));
      
      res.status(200).end();
    }
  });
});

// module export
module.exports = router;
