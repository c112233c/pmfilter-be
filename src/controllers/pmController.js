import { env } from '../config/env.js';
import { cancelPm, createPm, getDashboardSummary, getPmById, listPm, updatePm } from '../services/pmService.js';

export async function dashboard(req, res) {
  res.json(await getDashboardSummary());
}

export async function getList(req, res) {
  res.json(await listPm(req.query, env.MAX_PAGE_SIZE));
}

export async function getOne(req, res) {
  res.json(await getPmById(req.params.id));
}

export async function create(req, res) {
  const result = await createPm(req.body, req.user);
  res.status(201).json(result);
}

export async function update(req, res) {
  res.json(await updatePm(req.params.id, req.body, req.user));
}

export async function cancel(req, res) {
  res.json(await cancelPm(req.params.id, req.user));
}
