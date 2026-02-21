import fetch from 'node-fetch';

async function run() {
  const url = 'http://localhost:3004/landstack/api/proxy?url=http%3A%2F%2F117.252.86.213%3A8080%2Fgeoserver%2Fapplication%2Fwms&REQUEST=GetMap&SERVICE=WMS&VERSION=1.1.1&FORMAT=image%2Fpng&STYLES=&TRANSPARENT=true&LAYERS=application%3Adistrict_boundary&TILED=true&WIDTH=256&HEIGHT=256&SRS=EPSG%3A4326&BBOX=76.640625%2C11.953125%2C77.34375%2C12.65625';
  const res = await fetch(url);
  console.log(res.status, res.headers.get('content-type'));
  console.log('x-proxy-auth:', res.headers.get('x-proxy-auth'));
  console.log('x-proxy-cache:', res.headers.get('x-proxy-cache'));
}
run();
