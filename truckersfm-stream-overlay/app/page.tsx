"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { MusicBrainzApi } from 'musicbrainz-api';
import ProgressBar from '../components/progress';

const musicbrainz = new MusicBrainzApi({
  appName: 'TruckersFM Stream Overlay',
  appVersion: '0.1.0',
  appContactInfo: 'contact@tumppi066.fi',
});

export default function Home() {
  const [since, setSince] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [end, setEnd] = useState<Date | null>(null);
  const { data: songData, error: songError } = useSWR("https://radiocloud.pro/api/public/v1/song/current", (url) => {
    return fetch(url).then((res) => res.json())
  }, { refreshInterval: 10000 });

  const { data: presenterData, error: presenterError } = useSWR("https://radiocloud.pro/api/public/v1/presenter/live", (url) => {
    return fetch(url).then((res) => res.json())
  }, { refreshInterval: 30000 });

  const artist = songData?.data.artist;
  const title = songData?.data.title;
  const cover = songData?.data.album_art;
  const timestamp = songData?.data.played_at;
  const intermission = end !== null && end.getTime() + 10 < new Date().getTime();

  const description = presenterData?.data.description;
  const name = presenterData?.data.user.name;
  const intermission_image = presenterData?.data.image;

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

  const getImageUrl = () => {
    if (intermission) {
      return intermission_image || "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/TruckersFM_New_Logo.png/960px-TruckersFM_New_Logo.png";
    }
    return cover;
  }

  const isValidDisambiguation = (text: string) => {
    if (!text) return true; // No disambiguation, valid
    if (text == "clean" || text == "explicit") return true;
    if (text.includes("Dolby Atmos")) return true;
    return false;
  }

  useEffect(() => {
    if (!link) return;
    let search_title = title;
    const featIndex = title.indexOf(" (feat. ");
    if (featIndex !== -1) {
      search_title = title.substring(0, featIndex);
    }
    const query = 'query=artist:"' + artist + '" AND recording:"' + search_title + '"';
    musicbrainz.search("recording", {query}).then((res) => {
      const recordings = res.recordings;
      if (recordings.length === 0) setEnd(null);
      console.log("Found " + recordings.length + " recordings for " + title + " by " + artist);
      for(let i = 0; i < recordings.length; i++) {
        const recording = recordings[i];
        if (!isValidDisambiguation(recording.disambiguation)) continue; // Skip disambiguated recordings
        console.log(i + " passed disambiguation check");
        if (recording.video) continue; // Skip video recordings
        console.log(i + " passed video check");
        if (recording.title.replaceAll("'", "’").toLowerCase() != search_title.replaceAll("'", "’").toLowerCase()) continue; // Skip recordings with different titles
        console.log(i + " passed title check");
        if (!recording.length) continue; // Skip recordings without length
        console.log(i + " passed length check");
        if (recording.length < 20000) continue; // Skip recordings with length less than 20 seconds
        console.log(i + " passed 20s check");
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
    <div className="border border-[#191919] flex rounded-xl w-xl h-40.5 font-geist bg-[#131313] relative p-4 overflow-hidden">
      {cover && <div className="w-32 h-32 rounded-md border z-10" style={{
        backgroundImage: `url(${getImageUrl()})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
      }} />}
      { !intermission ?
        <div className="flex flex-col pl-4 z-10">
          <p className="text-xl font-semibold">{title}</p>
          <p className="text-sm font-semibold">by {artist}</p>
          {end && <p className="text-sm">{since} / {timeBetween(new Date(timestamp * 1000), end)}</p>}
          {!end && <p className="text-sm">{since}</p>}
          <p className="text-sm text-[#8e8b8f] absolute bottom-4">Playing now on TruckersFM</p>
        </div>
        :
        <div className="flex flex-col pl-4 z-10">
          <p className="text-xl font-semibold">{description}</p>
          <p className="text-sm font-semibold">by {name}</p>
          <p className="text-sm text-[#8e8b8f] absolute bottom-4">Presenting now at TruckersFM</p>
        </div>
      }
      {cover &&
        <div className="absolute w-full h-full rounded-lg -my-4 -mx-4" style={{ 
          backgroundImage: `url(${getImageUrl()})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.3)',
        }} />
      }
      {end && <ProgressBar progress={Math.floor((new Date().getTime() - new Date(timestamp * 1000).getTime()) / (end.getTime() - new Date(timestamp * 1000).getTime()) * 100)} />}
    </div>
  );
}
