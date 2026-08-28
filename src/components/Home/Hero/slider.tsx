"use client";

import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Image from "next/image";
import { useCryptoMarket } from "@/hooks/useCryptoMarket";

const COIN_STYLES: Record<string, { background: string; padding: string; iconWidth: number; iconHeight: number }> = {
  bitcoin:       { background: "bg-warning bg-opacity-20", padding: "px-4 py-3", iconWidth: 18, iconHeight: 23 },
  ethereum:      { background: "bg-light_grey",            padding: "px-4 py-2", iconWidth: 18, iconHeight: 23 },
  "bitcoin-cash":{ background: "bg-warning bg-opacity-20", padding: "px-0 py-0", iconWidth: 46, iconHeight: 46 },
  litecoin:      { background: "bg-light_grey",            padding: "px-4 py-3", iconWidth: 18, iconHeight: 23 },
  solana:        { background: "bg-light_grey",            padding: "px-4 py-3", iconWidth: 24, iconHeight: 24 },
  dogecoin:      { background: "bg-light_grey",            padding: "px-0 py-0", iconWidth: 46, iconHeight: 46 },
};

const CardSlider = () => {
  const { marketData, isLoading } = useCryptoMarket();

  const settings = {
    autoplay: true,
    dots: false,
    arrows: false,
    infinite: true,
    autoplaySpeed: 1500,
    speed: 300,
    slidesToShow: 4,
    slidesToScroll: 1,
    cssEase: "ease-in-out",
    responsive: [
      {
        breakpoint: 479,
        settings: {
          slidesToShow: 1,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 4,
        },
      },
    ],
  };

  if (isLoading || !marketData) {
    return (
      <div className="lg:-mt-16 mt-16">
        <div className="flex gap-6 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[250px] px-5 py-6 bg-dark_grey bg-opacity-80 rounded-xl animate-pulse">
              <div className="flex items-center gap-5">
                <div className="w-[46px] h-[46px] rounded-full bg-gray-700" />
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-gray-700 rounded" />
                  <div className="h-3 w-16 bg-gray-700 rounded" />
                </div>
              </div>
              <div className="mt-7 space-y-2">
                <div className="h-5 w-28 bg-gray-700 rounded" />
                <div className="h-3 w-24 bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lg:-mt-16 mt-16">
      <Slider {...settings}>
        {marketData.map((coin) => {
          const style = COIN_STYLES[coin.id] || COIN_STYLES.bitcoin;
          const change = coin.price_change_percentage_24h ?? 0;
          const isPositive = change >= 0;
          const priceStr = `$${coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const markStr = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;

          return (
            <div key={coin.id} className="pr-6">
              <div className="px-5 py-6 bg-dark_grey bg-opacity-80 rounded-xl">
                <div className="flex items-center gap-5">
                  <div className={`${style.background} ${style.padding} rounded-full`}>
                    <Image
                      src={coin.image}
                      alt={coin.name}
                      width={style.iconWidth}
                      height={style.iconHeight}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <p className="text-white text-xs font-normal ">
                    <span className="text-16 font-bold mr-2">{coin.name}</span>
                    {coin.symbol.toUpperCase()}/USD
                  </p>
                </div>
                <div className="flex justify-between mt-7">
                  <div className="">
                    <p className="text-16 font-bold text-white mb-0 leading-none">
                      {priceStr}
                    </p>
                  </div>
                  <div className="">
                    <span className={`text-xs ${isPositive ? 'text-green-400' : 'text-error'}`}>
                      {markStr}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </Slider>
    </div>
  );
};

export default CardSlider;
