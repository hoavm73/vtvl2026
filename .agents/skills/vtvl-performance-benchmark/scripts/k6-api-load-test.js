// Kịch bản k6 Load Test chuẩn cho hệ thống HCM-UTE VTVL 360
// Chạy lệnh: k6 run -e BASE_URL=http://localhost:3360 -e TOKEN=<bearer_token> .agents/skills/vtvl-performance-benchmark/scripts/k6-api-load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady_read_and_list: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '15s', target: 50 },
        { duration: '30s', target: 150 },
        { duration: '15s', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(50)<120', 'p(95)<450', 'p(99)<900']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3360';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const headers = TOKEN
    ? { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const overviewRes = http.get(`${BASE_URL}/api/admin/overview?unitCode=ALL`, { headers });
  check(overviewRes, {
    'overview status 200/401': (r) => r.status === 200 || r.status === 401
  });

  const listRes = http.get(`${BASE_URL}/api/tickets?unitCode=CNTT&view=list&limit=50`, { headers });
  check(listRes, {
    'tickets list status 200/401': (r) => r.status === 200 || r.status === 401
  });

  sleep(0.2);
}
