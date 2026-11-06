import { Router } from 'express';
import { authenticate, authenticateApiKeyOrBearer, requireAnyRole, roles } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as pm from '../controllers/pmController.js';
import * as check from '../controllers/checkController.js';
import * as audit from '../controllers/auditController.js';

export const apiRouter = Router();
const viewers = [roles.viewer, roles.editor, roles.admin];
const editors = [roles.editor, roles.admin];


apiRouter.get('/dashboard/summary', authenticate, requireAnyRole(...viewers), asyncHandler(pm.dashboard));
apiRouter.get('/pm', authenticate, requireAnyRole(...viewers), asyncHandler(pm.getList));
apiRouter.post('/pm', authenticate, requireAnyRole(...editors), asyncHandler(pm.create));
apiRouter.get('/pm/:id', authenticate, requireAnyRole(...viewers), asyncHandler(pm.getOne));
apiRouter.put('/pm/:id', authenticate, requireAnyRole(...editors), asyncHandler(pm.update));
apiRouter.post('/pm/:id/cancel', authenticate, requireAnyRole(roles.admin), asyncHandler(pm.cancel));
apiRouter.post('/pm/check', authenticateApiKeyOrBearer, requireAnyRole(...viewers, roles.checker), asyncHandler(check.check));
apiRouter.get('/audit', authenticate, requireAnyRole(...viewers), asyncHandler(audit.list));
