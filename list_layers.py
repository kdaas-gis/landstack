
import requests
from requests.auth import HTTPBasicAuth
import xml.etree.ElementTree as ET

# Configuration


url = "https://rdgis.karnataka.gov.in/geoserver/BU_bengaluru_east_Sva/wfs"
user = "BU_bengaluru_east_Sva"

passwords_to_try = [
    "Or!U$er@bhm123",        # Known good password
]

params = {
    "service": "wfs",
    "version": "1.1.0",
    "request": "GetFeature",
    "typeName": "east_polygon", 
    "maxFeatures": "1",
    "outputFormat": "application/json",
    "srsname": "EPSG:4326"
}

print(f"Testing GetFeature with typeName={params['typeName']} & JSON output...")
response = requests.get(url, params=params, auth=HTTPBasicAuth(user, "Or!U$er@bhm123"), timeout=30)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(response.text[:200])

params['typeName'] = "BU_bengaluru_east_Sva:east_polygon" # Try with prefix
print(f"Testing GetFeature with typeName={params['typeName']}...")
response = requests.get(url, params=params, auth=HTTPBasicAuth(user, "Or!U$er@bhm123"), timeout=30)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(response.text[:200])

