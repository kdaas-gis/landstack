import requests
from requests.auth import HTTPBasicAuth

URL = "https://rdgis.karnataka.gov.in/geoserver/BU_anekal_Sva/wfs"
USER = "BU_anekal_Sva"
PASS = "Or!U$er@bhm123"
LAYER = "BU_anekal_Sva:anekal_polygon"

def check_columns():
    params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "DescribeFeatureType",
        "typeName": LAYER,
        "outputFormat": "application/json"
    }
    try:
        response = requests.get(URL, params=params, auth=HTTPBasicAuth(USER, PASS), timeout=30)
        print(response.text)
    except Exception as e:
        print(str(e))

if __name__ == "__main__":
    check_columns()
