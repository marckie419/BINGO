flatpickr("#birthDate", {
    dateFormat: "Y-m-d",
    maxDate: "today",
    defaultDate: "2000-01-01"
});

document.getElementById('captureMethod').addEventListener('change', function() {
    const personalInfo = document.getElementById('personalInfo');
    const qrSection = document.getElementById('qrSection');
    if (this.value === 'qr') {
        personalInfo.style.display = 'none';
        qrSection.style.display = 'block';
        startQrReader();
    } else {
        personalInfo.style.display = 'block';
        qrSection.style.display = 'none';
        stopQrReader();
    }
});

document.getElementById('verificationForm').addEventListener('submit', function(event) {
    event.preventDefault();
    if (validateForm()) {
        startLiveness();
    }
});

function validateForm() {
    const captureMethod = document.getElementById('captureMethod').value;
    let isValid = true;

    if (captureMethod === 'personal') {
        const requiredFields = ['firstName', 'lastName', 'birthDate'];
        requiredFields.forEach(field => {
            if (!document.getElementById(field).value) {
                isValid = false;
                alert(`${field} is required`);
            }
        });

        if (isValid) {
            isValid = validateFixedValues();
        }
    } else if (captureMethod === 'qr') {
        if (!document.getElementById('qrCodeValue').value) {
            isValid = false;
            alert('QR Code is required');
        }
    }
    return isValid;
}

function validateFixedValues() {
    const firstName = document.getElementById('firstName').value;
    const middleName = document.getElementById('middleName').value;
    const lastName = document.getElementById('lastName').value;
    const suffix = document.getElementById('suffix').value;
    const birthDate = document.getElementById('birthDate').value;
    const faceLivenessSessionId = "1234567890"; // This should be the session ID obtained after liveness check

    const fixedValues = {
        first_name: "Juan",
        middle_name: "Santos",
        last_name: "Dela Cruz",
        suffix: "Jr",
        birth_date: "1989-09-12",
    };

    if (firstName !== fixedValues.first_name ||
        middleName !== fixedValues.middle_name ||
        lastName !== fixedValues.last_name ||
        suffix !== fixedValues.suffix ||
        birthDate !== fixedValues.birth_date) {
        alert("Inputted data cannot be authorized");
        return false;
    }

    return true;
}

function startLiveness() {
    window.eKYC().start({
        pubKey: 'eyJpdiI6IjNMdno2WCtTYkppRjhWVEM3d0tkd3c9PSIsInZhbHVlIjoiSXN0bFZtM1BxT2F1WmZXUjF2ZkcwUT09IiwibWFjIjoiYmRkMThkZmZkYjI0ODEyNzAxZmM0MGNjOWE2ZDQ3MTJhNTNmZjk5OGIyNjYwMDE4YTIzZTIyMTM0NTMxMGI0MCIsInRhZyI6IiJ9'
    }).then((data) => {
        console.log('Liveness response data:', data);
        showLivenessResult(data);

        const sessionId = data.session_id || (data.result && data.result.session_id);
        if (sessionId) {
            document.getElementById('faceLivenessSessionId').value = sessionId;
            if (validateForm()) {
                submitTier1(sessionId);
            }
        } else {
            console.error('Liveness session ID not found in response');
            alert('Liveness session ID not found. Please try again.');
        }
    }).catch((err) => {
        console.log('error', err);
        showLivenessResult({ success: false, error: err.message });
    });
}

function showLivenessResult(data) {
    const responseContainer = document.getElementById('responseContainer');
    const response = document.getElementById('response');
    const formSection = document.getElementById('formSection');
    
    formSection.style.display = 'none';
    responseContainer.style.display = 'block';
    
    response.textContent = data.success ? 'Verification successful!' : `Verification failed: ${data.error}`;
    
    const livenessStep = document.getElementById('livenessStep');
    livenessStep.classList.remove('inactive');
}

function submitTier1(sessionId) {
    const captureMethod = document.getElementById('captureMethod').value;
    let url, data;

    if (captureMethod === 'personal') {
        const formData = new FormData(document.getElementById('verificationForm'));
        data = {
            first_name: formData.get('firstName'),
            middle_name: formData.get('middleName'),
            last_name: formData.get('lastName'),
            suffix: formData.get('suffix'),
            face_liveness_session_id: sessionId,
            birth_date: formData.get('birthDate')
        };
        url = 'https://ws.everify.gov.ph/api/dev/query';
    } else {
        data = {
            value: document.getElementById('qrCodeValue').value,
            face_liveness_session_id: sessionId
        };
        url = 'https://ws.everify.gov.ph/api/dev/query/qr';
    }

    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer TIER 1 TOKEN',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Tier 1 Success:', data);
        document.getElementById('tier1').textContent = JSON.stringify(data, undefined, 2);
        submitTier2(data, sessionId);
    })
    .catch(error => {
        console.error('Tier 1 Error:', error);
        alert('Tier 1 verification failed. Please try again.');
    });
}

function submitTier2(tier1Data, sessionId) {
    const captureMethod = document.getElementById('captureMethod').value;
    let data, url = 'https://ws.everify.gov.ph/api/dev/query/qr';

    if (captureMethod === 'personal') {
        data = {
            tier1Response: tier1Data,
            face_liveness_session_id: sessionId
        };
    } else {
        data = {
            value: document.getElementById('qrCodeValue').value,
            tier1Response: tier1Data,
            face_liveness_session_id: sessionId
        };
    }

    fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer TIER 2 TOKEN',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Tier 2 Success:', data);
        document.getElementById('tier2').textContent = JSON.stringify(data, undefined, 2);
        alert('Verification successful!');
        const completeStep = document.querySelectorAll('.progress-step')[2];
        completeStep.classList.remove('inactive');
    })
    .catch(error => {
        console.error('Tier 2 Error:', error);
        alert('Tier 2 verification failed. Please try again.');
    });
}

let qrReader;

function startQrReader() {
    const scanner = new Html5QrcodeScanner('reader', {
        qrbox: {
            width: 350,
            height: 350,
        }, 
        fps: 20, 
    });
    
    scanner.render(success, error);
    
    function success(result) {
        console.log(result);
        document.getElementById('qrCodeValue').value = result;
        scanner.clear();
        document.getElementById('reader').remove();
    }
}

function stopQrReader() {
    console.error(err);
}
