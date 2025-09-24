"use client";

import Image from "next/image";

export function ModalityLogoStrip() {
  return (
    <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-4">
      <Image src="/logos/Modalities/NARM.png" alt="NARM" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
      <Image src="/logos/Modalities/Hakomi.png" alt="Hakomi" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
      <Image src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
      <Image src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" width={160} height={48} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px" className="h-10 w-auto object-contain opacity-80" />
    </div>
  );
}

export default ModalityLogoStrip;
