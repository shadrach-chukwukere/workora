import React from "react";
import Image from "next/image";

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

const DEFAULT_AVATARS: AvatarItem[] = [
  {
    id: "1",
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    alt: "Verified user 1",
  },
  {
    id: "2",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
    alt: "Verified user 2",
  },
  {
    id: "3",
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80",
    alt: "Verified user 3",
  },
];

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