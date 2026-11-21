import { call } from '../../lib/callable';

export type SetStatusFn = (req: { schoolId: string; status: 'active' | 'disabled' }) => Promise<unknown>;

export const defaultSetStatus: SetStatusFn = (req) => call('setSchoolStatus', req);
