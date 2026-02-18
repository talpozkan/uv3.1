import requests

def test_api_login():
    url = "http://localhost:8000/api/v1/auth/login"
    payload = {
        "username": "admin@urolog.com",
        "password": "admin123"
    }
    # OAuth2PasswordRequestForm expects form data, not JSON
    try:
        print(f"POST {url}...")
        response = requests.post(url, data=payload)
        print(f"Status: {response.status_code}")
        data = response.json()
        token = data["access_token"]
        print("Login successful. Fetching patients...")
        
        headers = {"Authorization": f"Bearer {token}"}
        pat_url = "http://localhost:8000/api/v1/patients/"
        pat_response = requests.get(pat_url, headers=headers)
        # Get first patient ID from list
        if pat_response.status_code == 200:
            patients = pat_response.json()
            if patients:
                first_id = patients[0]["id"]
                print(f"Fetching details for patient: {first_id}")
                det_url = f"http://localhost:8000/api/v1/patients/{first_id}"
                det_response = requests.get(det_url, headers=headers)
                print(f"Detail Status: {det_response.status_code}")
                print(f"Detail Body Preview: {det_response.text[:500]}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_api_login()
