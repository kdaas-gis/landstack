import fetch from 'node-fetch';

async function run() {
  const url = 'http://localhost:3004/landstack/api/proxy?profile=bu_yelahanka&BBOX=77.5667,12.9199,77.6513,13.0078&request=GetFeature&service=WFS&version=1.1.0&outputFormat=application/json&srsname=EPSG:4326&typeName=yelahanka_polygon';
  const res = await fetch(url);
  console.log(res.status, res.headers.get('content-type'));
  const text = await res.text();
  console.log(text.substring(0, 500));
}
run();
