"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { MusicBrainzApi } from 'musicbrainz-api';
import { 
  getImageUrl, 
  timeSince,
  timeBetween,
  isValidRecording,
} from '../lib/tfm_utils';
import ProgressBar from '../components/progress';
import Image from 'next/image';
import "@/public/tfm.svg";

const musicbrainz = new MusicBrainzApi({
  appName: 'TruckersFM Stream Overlay',
  appVersion: '0.1.0',
  appContactInfo: 'contact@tumppi066.fi',
});

export default function Home() {
  const [since, setSince] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [end, setEnd] = useState<Date | null>(null);

  // Handle URL parameters (just scale atm)
  useEffect(() => {
    if (!window) return;
    const searchParams = new URLSearchParams(window.location.search);
    const scale = searchParams.get("scale") || "1";
    document.documentElement.style.setProperty("--scale", scale);
  }, [window]);

  // Song info fetched every 10 seconds
  const { data: songData, error: songError } = useSWR("https://radiocloud.pro/api/public/v1/song/current", (url) => {
    return fetch(url).then((res) => res.json());
  }, { refreshInterval: 10000 });

  // Presenter info fetched every 30 seconds
  // (Could be even slower but this is fine)
  const { data: presenterData, error: presenterError } = useSWR("https://radiocloud.pro/api/public/v1/presenter/live", (url) => {
    return fetch(url).then((res) => res.json());
  }, { refreshInterval: 30000 });

  const artist = songData?.data.artist;
  const title = songData?.data.title;
  const cover = songData?.data.album_art;
  const timestamp = songData?.data.played_at;
  const timestampDate = timestamp ? new Date(timestamp * 1000) : new Date();

  const description = presenterData?.data.description;
  const name = presenterData?.data.user.name;
  const intermission_image = presenterData?.data.image;

  // If the end time is set, then check if we are currently
  // in an intermission period (i.e. the song has ended and now ads are playing.)
  const intermission = end !== null && end.getTime() + 10 < new Date().getTime();

  // When the link changes we try to find the song on musicbrainz
  // to get it's length, the TFM API does not provide this info unfortunately.
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

      // Filter results for what we want
      for(let i = 0; i < recordings.length; i++) {
        const recording = recordings[i];
        const valid = isValidRecording(recording, search_title);
        if (!valid) continue;

        // Extract the data we want
        const length = recording.length;
        const endTime = timestampDate;
        endTime.setSeconds(endTime.getSeconds() + length / 1000);
        setEnd(endTime);
        return;
      }
      setEnd(null);
    }).catch((err) => {
      setEnd(null);
      console.error(err);
    });
  }, [link]);

  useEffect(() => {
    if (!songData) return;
    setLink(songData.data.link);
  }, [songData]);

  // Current song playback counter, updated every 2 seconds.
  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => {
      setSince(timeSince(timestampDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (songError || presenterError) return <div>TruckersFM API failed to return data</div>;

  return (
    <div className="border border-[#191919] flex rounded-xl w-xl font-geist bg-[#131313] relative p-4 overflow-hidden" style={{
      scale: 'var(--scale, 1)',
    }}>
      {/* Display the cover if we have one */}
      {cover && <div className="min-w-32 min-h-32 rounded-md border z-10" style={{
        backgroundImage: `url(${getImageUrl(intermission, intermission_image, cover)})`, 
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
          end && !intermission ? <p className="text-sm">{since} / {timeBetween(timestampDate, end)}</p> : null
        }

        {
          !end && !intermission ? <p className="text-sm">{since}</p> : null
        }
      </div>

      {/* If we have a cover image, then use that for the background too. */}
      {cover &&
        <div className="absolute w-full h-full rounded-lg -my-4 -mx-4" style={{ 
          backgroundImage: `url(${getImageUrl(intermission, intermission_image, cover)})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.3)',
        }} />
      }

      {/* Progress bar if we found end time info */}
      {end && !intermission && 
        <ProgressBar
          progress={
            (new Date().getTime() - timestampDate.getTime()) /
            (end.getTime() - timestampDate.getTime()) *
            100
          }
        />
      }
    </div>
  );
}
