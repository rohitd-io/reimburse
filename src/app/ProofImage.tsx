"use client";

import { useEffect, useState } from "react";

interface ProofImageProps {
  file?: File;
  src?: string;
  alt?: string;
  style?: React.CSSProperties;
}

export default function ProofImage({ file, src, alt, style }: ProofImageProps) {
  const [objectUrl, setObjectUrl] = useState<string>("");

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  const finalSrc = file ? objectUrl : src;

  if (file && !objectUrl) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={finalSrc} alt={alt} style={style} />
  );
}
