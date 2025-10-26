<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Spring } from 'svelte/motion';
    import RadialMenu from './RadialMenu.svelte';

    let {
        items,
        x,
        y,
        radius = 60,
        arc = 40,
        onSelect,
        onClose
    } = $props();

    let menuElement = $state<HTMLElement>();
    let highlightedIndex = $state(-1);
    let buttonElements = $state<HTMLButtonElement[]>([]);
    
    // Create an array of Spring objects, one for each menu item, with a better initial position.
    const springs = items.map((_, i) => {
        const initialRadius = 40; // Start on a small circle instead of a single point
        const startAngle = -arc / 2;
        const angleStep = items.length > 1 ? arc / (items.length - 1) : 0;
        const angle = (startAngle + i * angleStep) * (Math.PI / 180);
        const initialPos = { x: initialRadius * Math.cos(angle), y: initialRadius * Math.sin(angle) };
        return new Spring(initialPos, {
            stiffness: 0.25,
            damping: 0.8
        });
    });

    $effect(() => {
        // This effect calculates the ideal target position for each button
        // and tells the corresponding spring to animate towards it.
        const startAngle = -arc / 2;
        const angleStep = items.length > 1 ? arc / (items.length - 1) : 0;
        
        // 1. Calculate ideal target positions
        const targets = items.map((_, i) => {
            const angle = (startAngle + i * angleStep) * (Math.PI / 180);
            return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
        });

        // 2. Run a collision resolution pass to prevent overlap
        const buttonHeight = 40; // Approximate height of a button for collision check
        for (let iter = 0; iter < 5; iter++) { // Run a few iterations for stability
            for (let i = 0; i < targets.length; i++) {
                for (let j = i + 1; j < targets.length; j++) {
                    const a = targets[i];
                    const b = targets[j];
                    const dy = a.y - b.y;

                    if (Math.abs(dy) < buttonHeight) {
                        const overlap = buttonHeight - Math.abs(dy);
                        const sign = dy > 0 ? 1 : -1;
                        // Push both buttons apart vertically
                        a.y += (overlap / 2) * sign;
                        b.y -= (overlap / 2) * sign;
                    }
                }
            }
        }

        // 3. Set the final, adjusted targets on the springs
        targets.forEach((pos, i) => {
            if (springs[i]) {
                springs[i].target = pos;
            }
        });
    });

    let expandedIndex = $state(-1);
     $effect(() => {
        // If the highlighted item has children, it becomes the expanded one.
        if (highlightedIndex > -1 && items[highlightedIndex]?.children) {
            expandedIndex = highlightedIndex;
        } else if (highlightedIndex > -1 && expandedIndex > -1 && highlightedIndex !== expandedIndex) {
            // If we highlight a *different* main item, close the old sub-menu.
            expandedIndex = -1;
        }
    });

    function handleMouseMove(event: MouseEvent) {
        if (!menuElement) return;

        const rect = menuElement.getBoundingClientRect();
        const mouseX = event.clientX - (rect.left + rect.width / 2);
        const mouseY = event.clientY - (rect.top + rect.height / 2);

        const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
        if (distance < 40) { // Inner dead zone
            highlightedIndex = -1;
            // Moving back to the center closes any open sub-menu.
            expandedIndex = -1;
            return;
        }

        let foundIndex = -1;
        for (let i = 0; i < buttonElements.length; i++) {
            const button = buttonElements[i];
            if (!button) continue;

            const rect = button.getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom) {
                foundIndex = i;
                break;
            }
        }

        highlightedIndex = foundIndex;
    }

    function handleMouseUp() {
        if (highlightedIndex !== -1) {
            onSelect(items[highlightedIndex]);
            onClose(); // Close the menu after selection
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            onClose();
        }
    }

    function handleWindowMouseDown(event: MouseEvent) {
        // Only care about left-clicks
        if (event.button !== 0) return;

        // If the click is anywhere inside this menu's container div, do nothing.
        if (menuElement?.contains(event.target as Node)) {
            return;
        }
        
        // If we're here, the click was outside.
        onClose();
    }

    onMount(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);
        // Add a slight delay to avoid capturing the same mousedown that opened the menu
        setTimeout(() => window.addEventListener('mousedown', handleWindowMouseDown), 0);
    });

    onDestroy(() => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('mousedown', handleWindowMouseDown);
    });
</script>

<div
    bind:this={menuElement}
    class="fixed w-0 h-0 z-50"
    style:left="{x}px"
    style:top="{y}px"
>
    {#each items as item, i}
        <button
            bind:this={buttonElements[i]}
            type="button"
            class="absolute -translate-x-1/2 -translate-y-1/2 p-3 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm border transition-colors {
                highlightedIndex === i
                    ? 'bg-blue-500 text-white border-transparent'
                    : 'bg-white/70 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600'
            }"
            style:left="{springs[i]?.current.x}px"
            style:top="{springs[i]?.current.y}px"
            onclick={() => onSelect(item)}
        >
            <span class="text-xs font-semibold whitespace-nowrap flex items-center">
                {item.label}
                {#if item.children}
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="ml-1"><polyline points="9 18 15 12 9 6"></polyline></svg>
                {/if}
            </span>
        </button>
    {/each}

    {#if expandedIndex !== -1}
        {@const parentPosition = springs[expandedIndex].current}
        <!-- Use a #key block to force re-creation of the sub-menu when its items change -->
        {#key items[expandedIndex].children}
            <RadialMenu
                items={items[expandedIndex].children}
                x={x + parentPosition.x}
                y={y + parentPosition.y}
                radius={60}
                arc={items[expandedIndex].children.length === 2 ? 50 : 100}
                onSelect={onSelect}
                onClose={onClose}
            />
        {/key}
    {/if}
</div>