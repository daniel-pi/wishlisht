import React, { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, ExternalLink, Edit2, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Item {
  id: number;
  name: string;
  price: number;
  url: string;
  image_key?: string;
  category: string;
  priority: number;
}

// Minimalist Item Component
function SortableItem({ item, onEdit }: { item: Item; onEdit: (item: Item) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
    >
      <div className="aspect-square bg-gray-50 overflow-hidden relative border border-gray-100">
         {/* Drag Handle Overlay */}
        <div 
           {...attributes} 
           {...listeners}
           className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing hover:bg-black/5 transition-colors"
        />

        {/* Action Buttons (Visible on Hover/Focus) */}
        <div className="absolute top-1 right-1 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="p-1 bg-white border border-gray-200 text-black hover:bg-gray-50"
          >
            <Edit2 size={10} />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="p-1 bg-white border border-gray-200 text-black hover:bg-gray-50"
          >
            <ExternalLink size={10} />
          </a>
        </div>

        {item.image_key ? (
          <img
            src={`/image/${item.image_key}`}
            alt={item.name}
            className="w-full h-full object-contain p-2 mix-blend-multiply"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[9px] text-gray-400 uppercase tracking-widest">No Img</span>
          </div>
        )}
      </div>

      <div className="mt-2 text-center">
         <p className="text-[10px] uppercase tracking-wide text-gray-500 truncate">{item.name}</p>
         <p className="text-[10px] font-mono font-medium text-black">${item.price.toFixed(2)}</p>
      </div>
    </div>
  );
}

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    url: '',
    category: 'Toys',
    imageFile: null as File | null,
    currentImageKey: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = () => {
    fetch('/api/items')
      .then((res) => res.json())
      .then((data) => setItems(data));
  };

  const openModal = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        price: item.price.toString(),
        url: item.url,
        category: item.category,
        imageFile: null,
        currentImageKey: item.image_key || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        price: '',
        url: '',
        category: activeCategory === 'All' ? 'Toys' : activeCategory,
        imageFile: null,
        currentImageKey: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save new order
        newItems.forEach((item, index) => {
           fetch(`/api/items/${item.id}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ priority: index }),
           });
        });

        return newItems;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submit

    setIsSubmitting(true);
    
    try {
      let imageKey = formData.currentImageKey;
      
      // Upload new image if selected
      if (formData.imageFile) {
        const key = `img-${Date.now()}-${formData.imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
        await fetch(`/api/upload/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': formData.imageFile.type },
          body: formData.imageFile
        });
        imageKey = key;
      }

      // Prepend https:// if missing
      let submitUrl = formData.url.trim();
      if (submitUrl && !/^https?:\/\//i.test(submitUrl)) {
        submitUrl = 'https://' + submitUrl;
      }

      const payload = {
        name: formData.name,
        price: parseFloat(formData.price),
        url: submitUrl,
        category: formData.category,
        image_key: imageKey,
        ...(editingItem ? {} : { priority: items.length }) 
      };

      if (editingItem) {
        await fetch(`/api/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      console.error("Error submitting:", err);
      alert("Failed to save item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    setIsSubmitting(true);
    try {
      await fetch(`/api/items/${editingItem.id}`, {
        method: 'DELETE',
      });
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      console.error("Error deleting:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ['All', 'Toys', 'Clothing', 'Furniture', 'Tech', 'Other'];
  const filteredItems = activeCategory === 'All' 
    ? items 
    : items.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold tracking-tight uppercase">Wishlisht</h1>
            
            <nav className="hidden md:flex items-center gap-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "text-[11px] uppercase tracking-wide hover:text-black transition-colors cursor-pointer",
                    activeCategory === cat ? "text-black font-bold border-b border-black" : "text-gray-400"
                  )}
                >
                  {cat}
                </button>
              ))}
            </nav>
          </div>

          <button
            onClick={() => openModal()}
            className="flex items-center gap-1 bg-black text-white px-3 py-1 text-[10px] uppercase tracking-wider font-bold hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <Plus size={12} />
            Add New
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <main className="max-w-[1600px] mx-auto px-4 pt-20 pb-12">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filteredItems.map(i => i.id)} strategy={rectSortingStrategy}>
            {/* Extremely dense grid: starts at 4 cols, goes up to 10 */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-4 gap-y-8">
              {filteredItems.map((item) => (
                <SortableItem key={item.id} item={item} onEdit={openModal} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-40 opacity-30">
            <p className="text-xs uppercase tracking-widest">Empty Category</p>
          </div>
        )}
      </main>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-black shadow-2xl p-6 relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-black hover:opacity-50 cursor-pointer"
            >
              <X size={16} />
            </button>
            
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-black pb-2">
              {editingItem ? 'Edit Product' : 'New Product'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wide">Product Title</label>
                <input
                  required
                  autoFocus
                  type="text"
                  name="product_title" // Obscure name to confuse autofill
                  className="w-full bg-gray-50 border-b border-gray-200 p-2 text-sm focus:outline-none focus:border-black transition-colors rounded-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wide">Price</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-gray-50 border-b border-gray-200 p-2 text-sm focus:outline-none focus:border-black transition-colors rounded-none"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold uppercase tracking-wide">Category</label>
                   <select
                    className="w-full bg-gray-50 border-b border-gray-200 p-2 text-sm focus:outline-none focus:border-black transition-colors rounded-none appearance-none"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                   >
                     {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                   </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wide">Link URL</label>
                <input
                  required
                  type="text"
                  className="w-full bg-gray-50 border-b border-gray-200 p-2 text-sm focus:outline-none focus:border-black transition-colors rounded-none"
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                />
              </div>

              <div className="space-y-1 pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-2">Image</label>
                <div className="flex items-center gap-4">
                  {formData.currentImageKey && !formData.imageFile && (
                    <div className="w-12 h-12 border border-gray-200 p-1 flex-shrink-0">
                      <img src={`/image/${formData.currentImageKey}`} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={e => setFormData({...formData, imageFile: e.target.files ? e.target.files[0] : null})}
                    />
                    <label 
                      htmlFor="image-upload"
                      className="inline-block bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-gray-800 transition-colors"
                    >
                      {formData.imageFile ? 'Change File' : 'Choose File'}
                    </label>
                    <p className="mt-1 text-[10px] text-gray-500 truncate">
                      {formData.imageFile ? formData.imageFile.name : 'No file chosen'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-black text-white py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
                
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="w-full bg-white text-red-600 border border-red-200 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  >
                    Delete Item
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
