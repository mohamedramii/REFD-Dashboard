import type { SVGProps } from "react";

function Icon({ d, ...props }: Omit<SVGProps<SVGSVGElement>, "d"> & { d: string | string[] }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5" {...props}>
      {paths.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

export const Icons = {
  clipboard: () => <Icon d={["M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z", "M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2", "m9 14 2 2 4-4"]} />,
  home: () => <Icon d={["M3 11.5 12 4l9 7.5", "M5 10v10h14V10", "M10 20v-5h4v5"]} />,
  check: () => <Icon d={["M20 6 9 17l-5-5"]} />,
  heart: () => <Icon d={["M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 1 1 12 6.4a4.8 4.8 0 1 1 7.5 6.2Z"]} />,
  clock: () => <Icon d={["M12 7v5l3 2", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"]} />,
  baby: () => <Icon d={["M9 12h.01M15 12h.01", "M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 3c-1 1.5-1 3 0 4"]} />,
  pin: () => <Icon d={["M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"]} />,
  brain: () => <Icon d={["M9 4a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10a3 3 0 0 0 1 2.2A3 3 0 0 0 6 17a3 3 0 0 0 3 3V4Z", "M15 4a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 10a3 3 0 0 1-1 2.2A3 3 0 0 1 18 17a3 3 0 0 1-3 3V4Z"]} />,
  alert: () => <Icon d={["M12 9v4", "M12 17h.01", "M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"]} />,
  refresh: () => <Icon d={["M20 11a8 8 0 0 0-14.9-3.5L4 9", "M4 4v5h5", "M4 13a8 8 0 0 0 14.9 3.5L20 15", "M20 20v-5h-5"]} />,
  hospital: () => <Icon d={["M4 21V7l8-4 8 4v14", "M9 21v-5h6v5", "M12 8v5M9.5 10.5h5"]} />,
  search: () => <Icon d={["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"]} />,
  filter: () => <Icon d={["M4 5h16l-6 8v6l-4-2v-4L4 5Z"]} />,
  calendar: () => <Icon d={["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z", "M8 12h2M14 12h2M8 16h2"]} />,
  printer: () => <Icon d={["M7 9V3h10v6", "M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M7 14h10v7H7z"]} />,
  x: () => <Icon d={["M18 6 6 18M6 6l12 12"]} />,
};
