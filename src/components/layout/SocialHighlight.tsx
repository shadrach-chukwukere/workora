import React from "react";
import Image from "next/image";
import { PORTRAITS } from "@/lib/portraits";

export interface AvatarItem {
  id: string;
  src: string;
  alt: string;
}

interface SocialProofBadgeProps {
  avatars?: AvatarItem[];
  highlightText?: string;
  descriptionText?: string;
  className?: string;
}

const DEFAULT_AVATARS: AvatarItem[] = PORTRAITS.slice(0, 3).map((src, index) => ({
  id: String(index + 1),
  src,
  alt: `Verified user ${index + 1}`,
}));

export const SocialProofBadge: React.FC<SocialProofBadgeProps> = ({
  avatars = DEFAULT_AVATARS,
  highlightText = "1M+",
  descriptionText = "jobs completed, rated, and reviewed",
  className = "",
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="flex shrink-0 -space-x-2.5">
        {avatars.map((avatar, index) => (
          <Image
            key={avatar.id}
            src={avatar.src}
            alt={avatar.alt}
            width={32}
            height={32}
            sizes="32px"
            quality={75}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-neutral-950"
            style={{ zIndex: avatars.length - index }}
          />
        ))}
      </div>

      <p className="text-sm leading-tight tracking-tight">
        <span className="font-semibold">{highlightText}</span>{" "}
        <span className="font-normal text-neutral-500 dark:text-neutral-400">
          {descriptionText}
        </span>
      </p>
    </div>
  );
};

export default SocialProofBadge;