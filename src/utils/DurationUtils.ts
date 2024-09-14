export default class DurationUtils {
  static humanizeDuration(time: number): string {
    const seconds = Math.floor((time) % 60);
    const minutes = Math.floor((time / 60) % 60);
    const hours = Math.floor((time / (60 * 60)));

    let s = '';

    if (hours !== 0) {
      s += (hours + ` hour${hours === 1 ? '' : 's'} `);
    }

    if (minutes !== 0) {
      s += (minutes + ` minute${minutes === 1 ? '' : 's'} `);
    }

    if (seconds !== 0) {
      s += (seconds + ` second${seconds === 1 ? '' : 's'} `);
    }

    return s.trimEnd();
  }
}