import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { CategorySidebar } from "@/components/CategorySidebar";
import { MenuItemCard } from "@/components/MenuItemCard";
import { CartPanel } from "@/components/CartPanel";
import { HeroBanner } from "@/components/HeroBanner";
import { MobileCart } from "@/components/MobileCart";
import { MobileProfilePanel } from "@/components/MobileProfilePanel";
import { PopularNow } from "@/components/PopularNow";
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
import { LogOut, UtensilsCrossed, LayoutDashboard, MapPin } from "lucide-react";

export default function Menu() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const { campus } = useCampus();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const {
    filteredItems,
    popularItems,
    // We will use 'allItems' if it exists in your hook, otherwise we fallback
    // assuming your hook exposes the raw list. If not, we use this trick:
    currentPeriod,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    refetch,
  } = useMenuItems();

  const handleSignOut = () => {
    navigate("/auth?logout=true");
  };

  // --- TEMP FIX FOR TESTING ---
  // If filteredItems is empty (due to time), we use popularItems as a fallback
  // just so you can see *something* to click on.
  // Ideally, you should update the 'available_time_periods' in Supabase,
  // but this code change forces items to show up if the time filter hides everything.
  const itemsToShow = filteredItems.length > 0 ? filteredItems : popularItems;

  // Filter items by search query
  const searchedItems = searchQuery
    ? itemsToShow.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : itemsToShow;

  return (
    <PageTransition>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 flex-none">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              {campus && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full">
                  <MapPin size={12} className="text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    {campus.code}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Admin Dashboard Button */}
              {user?.role === 'admin' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg gap-1.5 h-8 text-xs font-medium"
                  onClick={() => navigate("/admin")}
                >
                  <LayoutDashboard size={14} />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}

              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Category Sidebar */}
          <CategorySidebar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onProfileClick={() => setIsProfileOpen(true)}
          />

          {/* Menu Grid */}
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-6">
            <div className="p-4 lg:p-5">
              <HeroBanner />

              {/* Search Bar */}
              <div className="mb-4">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search for dishes..."
                />
              </div>

              {/* Time Period Banner */}
              {currentPeriod && !searchQuery && selectedCategory === "all" && (
                <TimePeriodBanner period={currentPeriod} />
              )}

              {/* Popular Now Section */}
              {!isLoading && !error && popularItems.length > 0 && selectedCategory === "all" && !searchQuery && (
                <PopularNow items={popularItems} />
              )}

              {/* Section Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg lg:text-xl font-semibold text-foreground">
                  {searchQuery
                    ? `Results for "${searchQuery}"`
                    : selectedCategory === "all"
                      ? "All Items"
                      : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                </h2>
                {!isLoading && !error && (
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    {searchedItems.length} items
                  </span>
                )}
              </div>

              {/* Loading State */}
              {isLoading && <MenuItemSkeletonGrid count={6} />}

              {/* Error State */}
              {error && !isLoading && (
                <ErrorState message={error} onRetry={refetch} />
              )}

              {/* Menu Grid */}
              {!isLoading && !error && searchedItems.length > 0 && (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                >
                  {searchedItems.map((item) => (
                    <motion.div key={item.id} variants={staggerItem}>
                      <MenuItemCard item={item} />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Empty State */}
              {!isLoading && !error && searchedItems.length === 0 && (
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

          {/* Cart Panel - Desktop */}
          {totalItems > 0 && (
            <aside className="hidden lg:block w-[340px] bg-card border-l border-border h-full overflow-y-auto">
              <CartPanel />
            </aside>
          )}
        </div>

        {/* Mobile Profile Panel */}
        <MobileProfilePanel
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onSignOut={handleSignOut}
        />

        {/* Mobile Cart */}
        <MobileCart />
      </div>
    </PageTransition>
  );
}