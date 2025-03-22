"use client";

import Image from "next/image";
import useSWR from "swr";
import { useEffect, useState } from "react";

export default function Home() {
  const [since, setSince] = useState<string>("");
  const { data, error } = useSWR("https://radiocloud.pro/api/public/v1/song/current", (url) => {
    return fetch(url).then((res) => res.json())
  }, { refreshInterval: 10000 });
  
  const artist = data?.data.artist;
  const title = data?.data.title;
  const cover = data?.data.album_art;
  const timestamp = data?.data.played_at;

  const timeSince = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 1000 / 60) % 60;
    const seconds = Math.floor(diff / 1000) % 60;
  
    const minutesString = minutes.toString().padStart(2, '0');
    const secondsString = seconds.toString().padStart(2, '0');
    return `${minutesString}:${secondsString}`;
  }

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => {
      setSince(timeSince(new Date(timestamp * 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (error) return <div>TruckersFM API failed to return data</div>;

  return (
    <div className="border border-[#191919] flex rounded-xl w-xl h-40.5 font-geist bg-[#131313] relative p-4 overflow-hidden">
      {cover && <Image src={cover} alt="Cover" width={200} height={200} className="w-32 h-32 rounded-md border z-10" />}
      <div className="flex flex-col pl-4 z-10">
        <p className="text-xl font-semibold">{title}</p>
        <p className="text-sm font-semibold">by {artist}</p>
        <p className="text-sm">{since}</p>
        <p className="text-sm text-[#8e8b8f] absolute bottom-4">Playing now on TruckersFM</p>
      </div>
      {cover &&
        <div className="absolute w-full h-full rounded-lg -my-4 -mx-4" style={{ 
          backgroundImage: `url(${cover})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          filter: 'blur(20px) brightness(0.15)',
        }} />
      }
    </div>
  );
}
