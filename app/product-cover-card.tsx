import Image from "next/image";
import Link from "next/link";
import { getProductPath, type Course } from "./course-data";

export default function ProductCoverCard({
  course,
  priority = false,
}: {
  course: Course;
  priority?: boolean;
}) {
  const poster = course.coverImage;
  const portrait = course.imageMode === "photo";

  return (
    <Link
      aria-label={poster ? `${course.statusLabel}. ${course.title}` : undefined}
      className={`group relative block aspect-[3/5] overflow-hidden rounded-[32px] !text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cda45c] ${
        portrait && !poster ? "bg-[#6a6a70]" : "bg-[#3b0a15]"
      }`}
      href={getProductPath(course)}
    >
      {poster ? (
        <Image
          alt=""
          className="object-cover object-center"
          fill
          priority={priority}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 86vw"
          src={poster}
        />
      ) : portrait ? (
        <Image
          alt=""
          className="object-cover object-[center_22%] grayscale contrast-[1.12]"
          fill
          priority={priority}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 86vw"
          src="/neuza-pinto.jpg"
        />
      ) : (
        <div className="absolute inset-x-4 top-6 bottom-[34%]">
          <Image
            alt={course.alt}
            className="object-contain object-center"
            fill
            priority={priority}
            sizes="(min-width: 1024px) 320px, 80vw"
            src={course.image}
          />
        </div>
      )}

      {poster ? null : (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[2] bg-[linear-gradient(to_top,rgba(18,18,20,0.78)_0%,rgba(18,18,20,0.22)_24%,transparent_46%)]"
        />
      )}

      <p className="absolute left-[-48px] top-[30px] z-[4] w-[196px] -rotate-[40deg] bg-[#7c2434] py-1.5 text-center text-[9px] font-bold uppercase leading-none tracking-[0.06em] text-white shadow-[0_8px_16px_rgba(0,0,0,0.28)]">
        {course.statusLabel}
      </p>

      {poster ? null : (
        <div className="absolute inset-x-0 bottom-0 z-[3] px-5 pb-5 text-white sm:px-6 sm:pb-6">
          <p className="text-[clamp(2.35rem,3.4vw,3.15rem)] font-bold leading-none tracking-[0.02em] text-white">
            {course.shortName}
          </p>
          <p className="mt-2 text-[12px] font-semibold uppercase leading-tight tracking-[0.14em] text-white sm:text-[13px]">
            {course.title}
          </p>
          <p className="mt-1.5 line-clamp-2 max-w-[15rem] text-[13px] italic leading-snug text-white/85">
            {course.tagline}
          </p>
          <span className="relative mt-4 block h-7 w-[92px]">
            <Image
              alt=""
              className="object-contain object-left"
              fill
              sizes="92px"
              src="/kitadi-logo.png"
            />
          </span>
        </div>
      )}
    </Link>
  );
}
