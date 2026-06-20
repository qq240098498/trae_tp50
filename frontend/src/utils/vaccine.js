import dayjs from 'dayjs';

export const VACCINE_NEAR_EXPIRE_DAYS = 7;

export function getVaccineStatus(expireDate) {
  if (!expireDate) {
    return { label: '未设置', color: 'default', daysRemaining: null, shouldAlert: false, status: 'unknown' };
  }
  const today = dayjs().startOf('day');
  const expire = dayjs(expireDate).startOf('day');
  const diff = expire.diff(today, 'day');
  if (diff < 0) {
    return { label: `已过期${Math.abs(diff)}天`, color: 'red', daysRemaining: diff, shouldAlert: true, status: 'expired' };
  }
  if (diff <= VACCINE_NEAR_EXPIRE_DAYS) {
    return { label: `临期${diff}天`, color: 'orange', daysRemaining: diff, shouldAlert: true, status: 'expiring' };
  }
  return { label: `有效${diff}天`, color: 'green', daysRemaining: diff, shouldAlert: false, status: 'valid' };
}
