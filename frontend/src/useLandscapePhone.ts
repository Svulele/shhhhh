import { useMediaQuery } from './useInput';
export const useLandscapePhone = () =>
  useMediaQuery('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)');
