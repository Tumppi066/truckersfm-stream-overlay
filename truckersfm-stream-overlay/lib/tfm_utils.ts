import { IRecordingMatch } from "musicbrainz-api";

export function getImageUrl(intermission: boolean, intermission_image: string | null, cover: string | null) {
    if (intermission) {
      // Until TFM releases an updated 1x1 image then this is the best standby we can do...
      return intermission_image || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/TruckersFM_New_Logo.png/960px-TruckersFM_New_Logo.png";
    }
    return cover;
} 

// Disambiguation is what musicbrainz uses to seperate "similar" recordings.
// These are ones that are close enough to the original recording that
// we can use their end time.
export function isValidDisambiguation(text: string) {
    if (!text) return true; // No disambiguation, valid
    if (text == "clean" || text == "explicit") return true;
    if (text.includes("Dolby Atmos")) return true;
    if (text.includes("album version")) return true;
    if (text.includes("Eurovision")) return true; // This is slightly scary, but it should mostly match the real song
                                                  // If anything it's too short, and that is fine I think...
    return false;
}

export function timeSince (date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 1000 / 60) % 60;
  const seconds = Math.floor(diff / 1000) % 60;

  const minutesString = minutes.toString().padStart(2, '0');
  const secondsString = seconds.toString().padStart(2, '0');
  return `${minutesString}:${secondsString}`;
}

export function timeBetween (start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const minutes = Math.floor(diff / 1000 / 60) % 60;
  const seconds = Math.floor(diff / 1000) % 60;

  const minutesString = minutes.toString().padStart(2, '0');
  const secondsString = seconds.toString().padStart(2, '0');
  return `${minutesString}:${secondsString}`;
}

export function similarity (a: string, b: string) {
  const aWords = a.toLowerCase().split(/\s+/);
  const bWords = b.toLowerCase().split(/\s+/);
  let matches = 0;

  for (const wordA of aWords) {
    if (bWords.includes(wordA)) {
      matches++;
    }
  }

  return matches / Math.max(aWords.length, bWords.length);
}

export function isValidRecording(recording: IRecordingMatch, search_title: string) { 
    if (!isValidDisambiguation(recording.disambiguation)) 
        return false; // Skip disambiguated recordings
    if (recording.video) 
        return false; // Skip video recordings (these are usually official MVs with non-music intros)

    const title_similarity = similarity(recording.title.replaceAll("'", "’").toLowerCase(), search_title.replaceAll("'", "’").toLowerCase());
    if (title_similarity < 0.75) 
        return false; // Skip recordings with low title similarity (i.e. live performances that might not necessarily match lengthwise)

    if (recording.title.replaceAll("'", "’").toLowerCase() != search_title.replaceAll("'", "’").toLowerCase()) 
        return false; // Skip recordings with different titles
    if (!recording.length) 
        return false; // Skip recordings without length
    if (recording.length < 20000) 
        return false; // Skip recordings with length less than 20 seconds

    return true;
}