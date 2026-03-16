import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { CategoryChips } from "@/components/CategoryChips";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartPanel } from "@/components/CartPanel";
import { HeroBanner } from "@/components/HeroBanner";
import { MobileCart } from "@/components/MobileCart";
import { MobileProfilePanel } from "@/components/MobileProfilePanel";
import { TimePeriodBanner } from "@/components/TimePeriodBanner";
import { MenuItemSkeletonGrid } from "@/components/skeletons/MenuItemSkeleton";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageTransition, staggerContainer, staggerItem } from "@/components/PageTransition";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCampus } from "@/context/CampusContext";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, LayoutDashboard, MapPin, Clock, User } from "lucide-react";

export default function Menu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { totalItems } = useCart();
  const { campus } = useCampus();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    filteredItems,
    currentPeriod,
    canteenClosed,
    nextOpenTime,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    refetch,
  } = useMenuItems();

  const handleSignOut = () => {
    navigate("/auth?logout=true");
  };

  const searchedItems = searchQuery
    ? filteredItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredItems;

  return (
    <PageTransition>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 glass border-b border-border/40 flex-none">
          <div className="flex items-center justify-between px-3 lg:px-5 h-13">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              {campus && (
                <div className="badge-vibrant">
                  <MapPin size={12} />
                  <span className="tracking-wider text-xs">{campus.code}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {user?.role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs font-semibold border-border/60"
                  onClick={() => navigate("/admin")}
                >
                  <LayoutDashboard size={15} />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              <ThemeToggle />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsProfileOpen(true)}
                className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-accent-foreground"
              >
                <User size={18} />
              </motion.button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto pb-28 lg:pb-6">
            <div className="p-4 lg:p-6">
              <HeroBanner />

              {/* Search */}
              <div className="mb-5">
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search for dishes..." />
              </div>

              {/* Category Chips */}
              {!canteenClosed && (
                <CategoryChips
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              )}

              {/* Canteen Closed */}
              {!isLoading && canteenClosed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 px-6 text-center"
                >
                  <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mb-5">
                    <Clock className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h2 className="font-display font-bold text-xl text-foreground mb-2">Canteen is Closed</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    We're currently not serving.{" "}
                    {nextOpenTime ? `Next opening: ${nextOpenTime}.` : "Please check back later."}
                  </p>
                </motion.div>
              )}

              {/* Time Period */}
              {currentPeriod && !searchQuery && selectedCategory === "all" && (
                <TimePeriodBanner period={currentPeriod} />
              )}

              {/* Section Header */}
              {!canteenClosed && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg lg:text-xl font-bold text-foreground">
                    {searchQuery
                      ? `Results for "${searchQuery}"`
                      : selectedCategory === "all"
                        ? "All Items"
                        : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                  </h2>
                  {!isLoading && !error && (
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-lg tabular-nums">
                      {searchedItems.length} items
                    </span>
                  )}
                </div>
              )}

              {/* Loading */}
              {isLoading && <MenuItemSkeletonGrid count={6} />}

              {/* Error */}
              {error && !isLoading && <ErrorState message={error} onRetry={refetch} />}

              {/* Menu Grid */}
              {!isLoading && !error && !canteenClosed && searchedItems.length > 0 && (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-5"
                >
                  {searchedItems.map((item) => (
                    <motion.div key={item.id} variants={staggerItem}>
                      <MenuItemCard item={item} />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Empty State */}
              {!isLoading && !error && !canteenClosed && searchedItems.length === 0 && (
                <EmptyState
                  icon={UtensilsCrossed}
                  title={searchQuery ? "No results found" : "No items available"}
                  description={
                    searchQuery
                      ? `No items match "${searchQuery}". Try a different search term.`
                      : "No items available in this category right now."
                  }
                  action={{
                    label: searchQuery ? "Clear Search" : "View All Items",
                    onClick: () => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    },
                  }}
                />
              )}
            </div>
          </main>

          {/* Desktop Cart */}
          {totalItems > 0 && (
            <aside className="hidden lg:block w-[360px] bg-card border-l border-border h-full overflow-y-auto">
              <CartPanel />
            </aside>
          )}
        </div>

        <MobileProfilePanel isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} onSignOut={handleSignOut} />
        <MobileCart />
      </div>
    </PageTransition>
  );
}
