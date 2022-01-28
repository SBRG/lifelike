import { FriendlyDateStrPipe } from './friendly-date-str.pipe';

describe('FriendlyDateStrPipe', () => {
  it('create an instance', () => {
    const pipe = new FriendlyDateStrPipe();
    expect(pipe).toBeTruthy();
  });
});
