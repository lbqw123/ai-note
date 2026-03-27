import * as React from "react"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/button"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

interface CarouselItemProps extends React.HTMLAttributes<HTMLDivElement> {}

const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [emblaRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins
    )

    React.useEffect(() => {
      if (setApi) {
        setApi(api)
      }
    }, [api, setApi])

    return (
      <div
        ref={ref}
        className={cn("relative", className)}
        {...props}
      >
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {React.Children.map(children, (child, index) => (
              <div key={index} className="min-w-0 shrink-0">
                {child}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
)
Carousel.displayName = "Carousel"

const CarouselItem = React.forwardRef<HTMLDivElement, CarouselItemProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  )
)
CarouselItem.displayName = "CarouselItem"

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    api: CarouselApi
    visible?: boolean
  }
>(({ api, visible = true, className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        buttonVariants({
          variant: "outline",
          size: "icon",
        }),
        "absolute  h-8 w-8 rounded-full",
        api?.canScrollPrev() ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
      disabled={!api?.canScrollPrev()}
      onClick={() => api?.scrollPrev()}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </button>
  )
})
CarouselPrevious.displayName = "CarouselPrevious"

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    api: CarouselApi
    visible?: boolean
  }
>(({ api, visible = true, className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        buttonVariants({
          variant: "outline",
          size: "icon",
        }),
        "absolute h-8 w-8 rounded-full",
        api?.canScrollNext() ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
      disabled={!api?.canScrollNext()}
      onClick={() => api?.scrollNext()}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </button>
  )
})
CarouselNext.displayName = "CarouselNext"

export { Carousel, CarouselItem, CarouselPrevious, CarouselNext }