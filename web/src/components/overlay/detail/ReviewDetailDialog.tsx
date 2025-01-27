import { isDesktop, isIOS, isMobile } from "react-device-detect";
import { Sheet, SheetContent } from "../../ui/sheet";
import { Drawer, DrawerContent } from "../../ui/drawer";
import useSWR from "swr";
import { FrigateConfig } from "@/types/frigateConfig";
import { useFormattedTimestamp } from "@/hooks/use-date-utils";
import { getIconForLabel } from "@/utils/iconUtil";
import { useApiHost } from "@/api";
import { ReviewDetailPaneType, ReviewSegment } from "@/types/review";
import { Event } from "@/types/event";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FrigatePlusDialog } from "../dialog/FrigatePlusDialog";
import ObjectLifecycle from "./ObjectLifecycle";
import Chip from "@/components/indicators/Chip";
import { FaDownload } from "react-icons/fa";
import FrigatePlusIcon from "@/components/icons/FrigatePlusIcon";
import { FaArrowsRotate } from "react-icons/fa6";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ReviewDetailDialogProps = {
  review?: ReviewSegment;
  setReview: (review: ReviewSegment | undefined) => void;
};
export default function ReviewDetailDialog({
  review,
  setReview,
}: ReviewDetailDialogProps) {
  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });

  // upload

  const [upload, setUpload] = useState<Event>();

  // data

  const { data: events } = useSWR<Event[]>(
    review ? ["event_ids", { ids: review.data.detections.join(",") }] : null,
  );

  const hasMismatch = useMemo(() => {
    if (!review || !events) {
      return false;
    }

    return events.length != review?.data.detections.length;
  }, [review, events]);

  const formattedDate = useFormattedTimestamp(
    review?.start_time ?? 0,
    config?.ui.time_format == "24hour"
      ? "%b %-d %Y, %H:%M"
      : "%b %-d %Y, %I:%M %p",
  );

  // content

  const [selectedEvent, setSelectedEvent] = useState<Event>();
  const [pane, setPane] = useState<ReviewDetailPaneType>("overview");

  const Overlay = isDesktop ? Sheet : Drawer;
  const Content = isDesktop ? SheetContent : DrawerContent;

  if (!review) {
    return;
  }

  return (
    <>
      <Overlay
        open={review != undefined}
        onOpenChange={(open) => {
          if (!open) {
            setReview(undefined);
            setSelectedEvent(undefined);
            setPane("overview");
          }
        }}
      >
        <FrigatePlusDialog
          upload={upload}
          onClose={() => setUpload(undefined)}
          onEventUploaded={() => {
            if (upload) {
              upload.plus_id = "new_upload";
            }
          }}
        />

        <Content
          className={cn(
            isDesktop
              ? pane == "overview"
                ? "sm:max-w-xl"
                : "pt-2 sm:max-w-4xl"
              : "max-h-[80dvh] overflow-hidden p-2 pb-4",
          )}
        >
          {pane == "overview" && (
            <div className="scrollbar-container mt-3 flex size-full flex-col gap-5 overflow-y-auto">
              <div className="flex w-full flex-row">
                <div className="flex w-full flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm text-primary/40">Camera</div>
                    <div className="text-sm capitalize">
                      {review.camera.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm text-primary/40">Timestamp</div>
                    <div className="text-sm">{formattedDate}</div>
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-sm text-primary/40">Objects</div>
                    <div className="flex flex-col items-start gap-2 text-sm capitalize">
                      {events?.map((event) => {
                        return (
                          <div
                            key={event.id}
                            className="flex flex-row items-center gap-2 capitalize"
                          >
                            {getIconForLabel(
                              event.label,
                              "size-3 text-primary",
                            )}
                            {event.sub_label ?? event.label} (
                            {Math.round(event.data.top_score * 100)}%)
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {review.data.zones.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-sm text-primary/40">Zones</div>
                      <div className="flex flex-col items-start gap-2 text-sm capitalize">
                        {review.data.zones.map((zone) => {
                          return (
                            <div
                              key={zone}
                              className="flex flex-row items-center gap-2 capitalize"
                            >
                              {zone.replaceAll("_", " ")}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {hasMismatch && (
                <div className="p-4 text-center text-sm">
                  Some objects that were detected are not included in this list
                  because the object does not have a snapshot
                </div>
              )}
              <div className="relative flex size-full flex-col gap-2">
                {events?.map((event) => (
                  <EventItem
                    key={event.id}
                    event={event}
                    setPane={setPane}
                    setSelectedEvent={setSelectedEvent}
                    setUpload={setUpload}
                  />
                ))}
              </div>
            </div>
          )}

          {pane == "details" && selectedEvent && (
            <div className="scrollbar-container overflow-x-none mt-0 flex size-full flex-col gap-2 overflow-y-auto overflow-x-hidden">
              <ObjectLifecycle
                review={review}
                event={selectedEvent}
                setPane={setPane}
              />
            </div>
          )}
        </Content>
      </Overlay>
    </>
  );
}

type EventItemProps = {
  event: Event;
  setPane: React.Dispatch<React.SetStateAction<ReviewDetailPaneType>>;
  setSelectedEvent: React.Dispatch<React.SetStateAction<Event | undefined>>;
  setUpload?: React.Dispatch<React.SetStateAction<Event | undefined>>;
};

function EventItem({
  event,
  setPane,
  setSelectedEvent,
  setUpload,
}: EventItemProps) {
  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });

  const apiHost = useApiHost();

  const imgRef = useRef(null);

  const [hovered, setHovered] = useState(isMobile);

  return (
    <>
      <div
        className={cn(
          "relative",
          !event.has_snapshot && "flex flex-row items-center justify-center",
        )}
        onMouseEnter={isDesktop ? () => setHovered(true) : undefined}
        onMouseLeave={isDesktop ? () => setHovered(false) : undefined}
        key={event.id}
      >
        {event.has_snapshot && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[30%] w-full rounded-lg bg-gradient-to-b from-black/20 to-transparent md:rounded-2xl"></div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[10%] w-full rounded-lg bg-gradient-to-t from-black/20 to-transparent md:rounded-2xl"></div>
          </>
        )}
        <img
          ref={imgRef}
          className={cn(
            "select-none rounded-lg object-contain transition-opacity",
          )}
          style={
            isIOS
              ? {
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }
              : undefined
          }
          draggable={false}
          src={
            event.has_snapshot
              ? `${apiHost}api/events/${event.id}/snapshot.jpg`
              : `${apiHost}api/events/${event.id}/thumbnail.jpg`
          }
        />
        {hovered && (
          <div>
            <div
              className={cn("absolute right-1 top-1 flex items-center gap-2")}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    download
                    href={
                      event.has_snapshot
                        ? `${apiHost}api/events/${event.id}/snapshot.jpg`
                        : `${apiHost}api/events/${event.id}/thumbnail.jpg`
                    }
                  >
                    <Chip className="cursor-pointer rounded-md bg-gray-500 bg-gradient-to-br from-gray-400 to-gray-500">
                      <FaDownload className="size-4 text-white" />
                    </Chip>
                  </a>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>

              {event.has_snapshot &&
                event.plus_id == undefined &&
                config?.plus.enabled && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Chip
                        className="cursor-pointer rounded-md bg-gray-500 bg-gradient-to-br from-gray-400 to-gray-500"
                        onClick={() => {
                          setUpload?.(event);
                        }}
                      >
                        <FrigatePlusIcon className="size-4 text-white" />
                      </Chip>
                    </TooltipTrigger>
                    <TooltipContent>Submit to Frigate+</TooltipContent>
                  </Tooltip>
                )}

              {event.has_clip && (
                <Tooltip>
                  <TooltipTrigger>
                    <Chip
                      className="cursor-pointer rounded-md bg-gray-500 bg-gradient-to-br from-gray-400 to-gray-500"
                      onClick={() => {
                        setPane("details");
                        setSelectedEvent(event);
                      }}
                    >
                      <FaArrowsRotate className="size-4 text-white" />
                    </Chip>
                  </TooltipTrigger>
                  <TooltipContent>View Object Lifecycle</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
