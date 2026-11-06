import { checkPm } from '../services/checkService.js';

export async function check(req, res) {
  res.json(await checkPm(req.body));
}
