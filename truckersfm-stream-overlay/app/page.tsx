"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { MusicBrainzApi } from 'musicbrainz-api';
import ProgressBar from '../components/progress';
import Image from 'next/image';
import "@/public/tfm.svg";

const timeSince = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 1000 / 60) % 60;
  const seconds = Math.floor(diff / 1000) % 60;

  const minutesString = minutes.toString().padStart(2, '0');
  const secondsString = seconds.toString().padStart(2, '0');
  return `${minutesString}:${secondsString}`;
}

const timeBetween = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  const minutes = Math.floor(diff / 1000 / 60) % 60;
  const seconds = Math.floor(diff / 1000) % 60;

  const minutesString = minutes.toString().padStart(2, '0');
  const secondsString = seconds.toString().padStart(2, '0');
  return `${minutesString}:${secondsString}`;
}

const similarity = (a: string, b: string) => {
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

const musicbrainz = new MusicBrainzApi({
  appName: 'TruckersFM Stream Overlay',
  appVersion: '0.1.0',
  appContactInfo: 'contact@tumppi066.fi',
});

export default function Home() {
  const [since, setSince] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [end, setEnd] = useState<Date | null>(null);

  // Get ?scale=... from the URL
  useEffect(() => {
    if (!window) return;
    const searchParams = new URLSearchParams(window.location.search);
    const scale = searchParams.get("scale") || "1";
    document.documentElement.style.setProperty("--scale", scale);
  }, [window])

  // Song info fetched every 10 seconds
  const { data: songData, error: songError } = useSWR("https://radiocloud.pro/api/public/v1/song/current", (url) => {
    return fetch(url).then((res) => res.json())
  }, { refreshInterval: 10000 });

  // Presenter info fetched every 30 seconds
  // (I could make it even slower but this is fine)
  const { data: presenterData, error: presenterError } = useSWR("https://radiocloud.pro/api/public/v1/presenter/live", (url) => {
    return fetch(url).then((res) => res.json())
  }, { refreshInterval: 30000 });

  const artist = songData?.data.artist;
  const title = songData?.data.title;
  const cover = songData?.data.album_art;
  const timestamp = songData?.data.played_at;

  const description = presenterData?.data.description;
  const name = presenterData?.data.user.name;
  const intermission_image = presenterData?.data.image;

  // If the end time is set, then check if we are currently
  // in an intermission period.
  const intermission = end !== null && end.getTime() + 10 < new Date().getTime();

  const getImageUrl = () => {
    if (intermission) {
      // Until TFM releases an updated 1x1 image then this is the best standby we can do...
      return intermission_image || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/TruckersFM_New_Logo.png/960px-TruckersFM_New_Logo.png";
    }
    return cover;
  }

  // Disambiguation is what musicbrainz uses to seperate "similar" recordings.
  // These are ones that are close enough to the original recording that
  // we can use their end time.
  const isValidDisambiguation = (text: string) => {
    if (!text) return true; // No disambiguation, valid
    if (text == "clean" || text == "explicit") return true;
    if (text.includes("Dolby Atmos")) return true;
    if (text.includes("album version")) return true;
    if (text.includes("Eurovision")) return true; // This is slightly scary, but it should mostly match the real song
                                                  // If anything it's too short, and that is fine I think...
    return false;
  }

  useEffect(() => {
    if (!link) return;

    // Filter out common non-title text from
    // the TFM title. (musicbrainz is really sensitive)
    const search_title = title.split(" (")[0];

    // Only use the first artist, sometimes multiple is better
    // but for the majority of songs just using one seems to work more reliably.
    const first_artist = artist.split(" & ")[0].split(" / ")[0].split(" and ")[0].split(" x ")[0].split(" vs. ")[0].split(",")[0];
    const query = `query=artist:"${first_artist}" AND recording:"${search_title}"`;

    // Get search results
    musicbrainz.search("recording", {query}).then((res) => {
      const recordings = res.recordings;
      if (recordings.length === 0) setEnd(null);
      console.log("Found " + recordings.length + " recordings for " + title + " by " + artist + " (" + query + ")");

      // Filter results for what we want
      for(let i = 0; i < recordings.length; i++) {
        const recording = recordings[i];
        if (!isValidDisambiguation(recording.disambiguation)) continue; // Skip disambiguated recordings
        console.log(i + " passed disambiguation check");

        if (recording.video) continue; // Skip video recordings
        console.log(i + " passed video check");

        const title_similarity = similarity(recording.title.replaceAll("'", "’").toLowerCase(), search_title.replaceAll("'", "’").toLowerCase());
        if (title_similarity < 0.75) continue;
        console.log(i + " passed similarity check");

        if (recording.title.replaceAll("'", "’").toLowerCase() != search_title.replaceAll("'", "’").toLowerCase()) continue; // Skip recordings with different titles
        console.log(i + " passed title check");

        if (!recording.length) continue; // Skip recordings without length
        console.log(i + " passed length check");

        if (recording.length < 20000) continue; // Skip recordings with length less than 20 seconds
        console.log(i + " passed 20s check");

        // Extract the data we want
        const length = recording.length;
        const endTime = new Date(timestamp * 1000);
        endTime.setSeconds(endTime.getSeconds() + length / 1000);
        setEnd(endTime);
        console.log("Found end time: " + endTime.toString() + " for " + title + " by " + artist);
        return;
      }
      setEnd(null);
    }).catch((err) => {
      setEnd(null);
      console.error(err);
    });
  }, [link]);

  // Update states when song data changes
  useEffect(() => {
    if (!songData) return;
    setLink(songData.data.link);
  }, [songData])

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => {
      setSince(timeSince(new Date(timestamp * 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (songError | presenterError) return <div>TruckersFM API failed to return data</div>;

  return (
    <div className="border border-[#191919] flex rounded-xl w-xl font-geist bg-[#131313] relative p-4 overflow-hidden" style={{
      scale: 'var(--scale, 1)',
    }}>
      {/* Display the cover if we have one */}
      {cover && <div className="min-w-32 min-h-32 rounded-md border z-10" style={{
        backgroundImage: `url(${getImageUrl()})`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />}

      {/* Current song / presenter information. */}
      <div className="flex flex-col pl-4 z-10 w-full">
        <div className="w-full flex justify-between items-start pr-2">
          <p className="text-xl">{intermission ? description : title}</p>
          <Image
            src="/tfm.svg"
            alt=""
            width={74}
            height={1}

            className="pt-2 hover:cursor-pointer"
            onClick={() => {
              window.open("https://truckers.fm/", "_blank");
            }}
          />
        </div>
        <p className="text-sm">by {intermission ? name : artist}</p>
        
        {
          end && !intermission ? <p className="text-sm">{since} / {timeBetween(new Date(timestamp * 1000), end)}</p> : null
        }

        {
          !end && !intermission ? <p className="text-sm">{since}</p> : null
        }
      </div>

      {/* If we have a cover image, then use that for the background too. */}
      {cover &&
        <div className="absolute w-full h-full rounded-lg -my-4 -mx-4" style={{ 
          backgroundImage: `url(${getImageUrl()})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.3)',
        }} />
      }

      {/* Progress bar if we found end time info. */}
      {end && !intermission && 
        <ProgressBar 
          progress={
            Math.floor((new Date().getTime() - new Date(timestamp * 1000).getTime()) / (end.getTime() - new Date(timestamp * 1000).getTime()) * 100)
          } 
        />
      }
    </div>
  );
}
