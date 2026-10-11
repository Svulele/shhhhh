import { useInputMode } from '../useInput';

export default function InputHint({ touch, keys }: { touch: string; keys: string }) {
  const mode = useInputMode();
  return mode === 'touch' ? <span className="touch-hint">{touch}</span> : <span className="kbd-hint">{keys}</span>;
}
