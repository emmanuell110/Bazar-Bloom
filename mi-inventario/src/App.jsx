import React, { useState, useEffect } from 'react';
import {
  Menu, X, Search, Filter, Plus, Trash2, Download,
  LogOut, Package, Upload, RefreshCw, User
} from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from './SupabaseClient';

// Importación del logo de la tienda
import logoImg from './assets/logo.jpeg';

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN (LOGIN SIMPLE POR USUARIO) ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('bazar_bloom_auth') === 'true';
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('bazar_bloom_username') || '';
  });
  const [loginInput, setLoginInput] = useState('');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('productos');
  const [isLoading, setIsLoading] = useState(false);

  // Filtros principales
  const [genderFilter, setGenderFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  const categoriesList = [
    'Blusas', 'Camisas', 'Camisetas', 'Pantalones',
    'Vestidos', 'Sudaderas', 'Tenis', 'Zapatos', 'Chanclas', 'Otros'
  ];

  // Estado de productos
  const [products, setProducts] = useState([]);

  // Formulario Nuevo Producto
  const [selectedFile, setSelectedFile] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    category: 'Camisetas',
    gender: 'Mujer',
    description: '',
    status: 'Nuevo',
    image: '',
    singlePrice: '',
    singleStock: '',
    variants: [{ size: 'M', price: '', stock: '' }]
  });

  // --- CONSULTA DE DATOS A SUPABASE ---
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        category: p.category,
        gender: p.gender,
        status: p.status,
        image: p.image || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&auto=format&fit=crop&q=60',
        description: p.description || '',
        singlePrice: Number(p.single_price) || 0,
        singleStock: Number(p.single_stock) || 0,
        variants: p.variants || []
      }));

      setProducts(formatted);
    } catch (error) {
      console.error('Error al cargar productos de Supabase:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
    }
  }, [isAuthenticated]);

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file) => {
    if (!file) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error al subir imagen:', error.message);
      return null;
    }
  };

  // Manejo del Login Simple
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginInput.trim()) {
      setIsAuthenticated(true);
      setUsername(loginInput.trim());
      localStorage.setItem('bazar_bloom_auth', 'true');
      localStorage.setItem('bazar_bloom_username', loginInput.trim());
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    localStorage.removeItem('bazar_bloom_auth');
    localStorage.removeItem('bazar_bloom_username');
    setIsSidebarOpen(false);
  };

  const handleAddVariant = () => {
    const defaultSize = newProduct.gender === 'Niños' ? '10-12 yrs' : 'M';
    setNewProduct({
      ...newProduct,
      variants: [...newProduct.variants, { size: defaultSize, price: '', stock: '' }]
    });
  };

  const handleVariantChange = (index, field, value) => {
    const updatedVariants = [...newProduct.variants];
    updatedVariants[index][field] = value;
    setNewProduct({ ...newProduct, variants: updatedVariants });
  };

  const handleRemoveVariant = (index) => {
    const updatedVariants = newProduct.variants.filter((_, i) => i !== index);
    setNewProduct({ ...newProduct, variants: updatedVariants });
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.brand) return;

    setIsLoading(true);
    let publicImageUrl = newProduct.image;

    if (selectedFile) {
      const uploadedUrl = await uploadImageToStorage(selectedFile);
      if (uploadedUrl) publicImageUrl = uploadedUrl;
    }

    const isOtros = newProduct.category === 'Otros';

    const payload = {
      name: newProduct.name,
      brand: newProduct.brand,
      category: newProduct.category,
      gender: isOtros ? 'Otros' : newProduct.gender,
      status: newProduct.status,
      image: publicImageUrl || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&auto=format&fit=crop&q=60',
      description: isOtros ? newProduct.description : '',
      single_price: isOtros ? Number(newProduct.singlePrice) || 0 : 0,
      single_stock: isOtros ? Number(newProduct.singleStock) || 0 : 0,
      variants: isOtros ? [] : newProduct.variants.map(v => ({
        size: v.size,
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0
      }))
    };

    const { error } = await supabase.from('products').insert([payload]);

    if (error) {
      console.error('Error al guardar producto:', error.message);
      alert('Error al guardar el producto en la base de datos.');
    } else {
      await fetchProducts();
      setNewProduct({
        name: '',
        brand: '',
        category: 'Camisetas',
        gender: 'Mujer',
        description: '',
        status: 'Nuevo',
        image: '',
        singlePrice: '',
        singleStock: '',
        variants: [{ size: 'M', price: '', stock: '' }]
      });
      setSelectedFile(null);
      setActiveTab('productos');
    }
    setIsLoading(false);
  };

  const handleUpdateStock = async (productId, variantIndex, newStock) => {
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;

    const parsedStock = Math.max(0, Number(newStock) || 0);

    let updatePayload = {};
    if (targetProduct.category === 'Otros') {
      updatePayload = { single_stock: parsedStock };
    } else {
      const updatedVariants = [...targetProduct.variants];
      updatedVariants[variantIndex].stock = parsedStock;
      updatePayload = { variants: updatedVariants };
    }

    setProducts(products.map(p => {
      if (p.id === productId) {
        return targetProduct.category === 'Otros'
          ? { ...p, singleStock: parsedStock }
          : { ...p, variants: updatePayload.variants };
      }
      return p;
    }));

    const { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    if (error) {
      console.error('Error al actualizar stock:', error.message);
      fetchProducts();
    }
  };

  const handleDeleteVariant = async (productId, variantIndex) => {
    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct) return;

    const updatedVariants = targetProduct.variants.filter((_, idx) => idx !== variantIndex);

    setProducts(products.map(p => p.id === productId ? { ...p, variants: updatedVariants } : p));

    const { error } = await supabase
      .from('products')
      .update({ variants: updatedVariants })
      .eq('id', productId);

    if (error) fetchProducts();
  };

  const handleDeleteProduct = async (id) => {
    const target = products.find(p => p.id === id);
    const totalStock = target?.category === 'Otros'
      ? target.singleStock
      : target?.variants.reduce((acc, curr) => acc + curr.stock, 0) || 0;

    if (totalStock > 0) {
      alert(`No se puede eliminar "${target.name}" porque aún tiene ${totalStock} unidades en existencias. Deja las existencias en 0 para borrarlo.`);
      return;
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al borrar producto:', error.message);
      alert('No se pudo borrar el producto.');
    } else {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;

    const matchesGender = genderFilter === 'Todos' ||
      p.gender === genderFilter ||
      (genderFilter === 'Otros' && p.category === 'Otros') ||
      p.gender === 'Todos';

    return matchesSearch && matchesCategory && matchesGender;
  });

  // Generación del PDF Bloom Bazar con Logo Oficial Integrado
  const downloadPDFCatalog = async () => {
    try {
      setIsLoading(true);
      const doc = new jsPDF();

      // Helper para convertir la imagen del logo local a formato Base64 para jsPDF
      const getLogoBase64 = () => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = logoImg;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(null);
        });
      };

      const logoBase64 = await getLogoBase64();

      const sections = [
        { key: 'Mujer', title: 'ROPA PARA MUJER' },
        { key: 'Hombre', title: 'ROPA PARA HOMBRE' },
        { key: 'Niños', title: 'ROPA PARA NIÑOS' },
        { key: 'Otros', title: 'OTROS PRODUCTOS' }
      ];

      const loadImage = (url) => {
        return new Promise((resolve) => {
          if (!url) resolve(null);
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = url;
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
        });
      };

      // --- PORTADA DEL PDF ---
      doc.setFillColor(253, 242, 248); // Fondo rosa suave
      doc.rect(0, 0, 210, 297, 'F');

      // Dibujar Logo Grande en la Portada
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 65, 45, 80, 80);
      }

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('BLOOM BAZAR', 105, 140, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(219, 39, 119);
      doc.text('Catálogo Oficial de Productos', 105, 150, { align: 'center' });

      doc.setDrawColor(219, 39, 119);
      doc.setLineWidth(0.8);
      doc.line(75, 158, 135, 158);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Edición: ${hoy}`, 105, 260, { align: 'center' });

      // --- SECCIONES Y PRODUCTOS ---
      for (const section of sections) {
        const sectionProducts = products.filter(p => {
          if (section.key === 'Otros') return p.category === 'Otros' || p.gender === 'Otros';
          return p.gender === section.key && p.category !== 'Otros';
        });

        if (sectionProducts.length === 0) continue;

        doc.addPage();

        // Encabezado con Logo Pequeño
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 14, 10, 16, 16);
        }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Bloom Bazar', 33, 20);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Catálogo de Inventario', 196, 20, { align: 'right' });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(14, 28, 196, 28);

        let yPos = 40;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, 14, yPos);

        yPos += 10;

        const colWidth = 86;
        const colGap = 10;
        const leftMargin = 14;
        const cardHeight = 105;

        for (let i = 0; i < sectionProducts.length; i++) {
          const prod = sectionProducts[i];
          const col = i % 2;
          const xPos = leftMargin + col * (colWidth + colGap);

          if (col === 0 && i > 0 && yPos + cardHeight > 280) {
            doc.addPage();

            if (logoBase64) {
              doc.addImage(logoBase64, 'PNG', 14, 10, 16, 16);
            }

            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('Bloom Bazar', 33, 20);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text('Catálogo de Inventario', 196, 20, { align: 'right' });

            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(14, 28, 196, 28);

            yPos = 40;
          }

          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(xPos, yPos, colWidth, cardHeight, 3, 3, 'FD');

          const imgWidth = 76;
          const imgHeight = 52;
          const imgX = xPos + (colWidth - imgWidth) / 2;
          const imgY = yPos + 5;

          if (prod.image) {
            const imgElement = await loadImage(prod.image);
            if (imgElement) {
              try {
                doc.addImage(imgElement, 'JPEG', imgX, imgY, imgWidth, imgHeight);
              } catch (e) {
                console.log("Error al cargar imagen de producto:", e);
              }
            }
          }

          let textY = imgY + imgHeight + 7;

          doc.setTextColor(15, 23, 42);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          const truncatedName = prod.name.length > 25 ? prod.name.substring(0, 25) + '...' : prod.name;
          doc.text(truncatedName, xPos + 5, textY);

          textY += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(219, 39, 119);
          doc.text(`${(prod.brand || 'N/A').toUpperCase()} • ${prod.category}`, xPos + 5, textY);

          textY += 6;

          if (prod.category === 'Otros') {
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            const desc = prod.description ? (prod.description.length > 38 ? prod.description.substring(0, 38) + '...' : prod.description) : 'Sin descripción';
            doc.text(desc, xPos + 5, textY);

            textY += 8;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`Precio: $${prod.singlePrice || 0}`, xPos + 5, textY);
          } else {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('Tallas y Precios:', xPos + 5, textY);

            textY += 4;
            const variants = prod.variants || [];

            variants.slice(0, 3).forEach(v => {
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(51, 65, 85);
              doc.text(`• Talla ${v.size}:`, xPos + 7, textY);

              doc.setFont('helvetica', 'bold');
              doc.setTextColor(219, 39, 119);
              doc.text(`$${v.price}`, xPos + 45, textY);

              textY += 4.5;
            });
          }

          if (col === 1 || i === sectionProducts.length - 1) {
            yPos += cardHeight + 8;
          }
        }
      }

      doc.save('catalogo_bloom_bazar.pdf');
    } catch (err) {
      console.error("Error PDF:", err);
      alert(`Error al generar el PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- FORMULARIO DE LOGIN SIN VERIFICACIÓN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-pink-100 text-center">
          <div className="mb-6 flex justify-center">
            <img src={logoImg} alt="Bloom Bazar Logo" className="h-44 w-auto object-contain" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Bienvenido al Inventario</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">Ingresa tu nombre de usuario para acceder</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre de Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Ej. Emman"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-pink-400 bg-slate-50 text-slate-800"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-pink-600 text-white font-medium py-3 rounded-xl text-sm shadow-md hover:bg-pink-700 transition">
              Entrar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* MENÚ LATERAL */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="h-10 w-auto rounded-md bg-white p-1" />
            <span className="font-bold text-base text-white">Bloom Bazar</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X size={24} /></button>
        </div>

        <nav className="p-4 space-y-2">
          <button onClick={() => { setActiveTab('productos'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'productos' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Package size={20} /> Catálogo / Productos
          </button>
          <button onClick={() => { setActiveTab('gestion'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'gestion' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Plus size={20} /> Agregar / Editar / Borrar
          </button>
          <button onClick={() => { setActiveTab('catalogo'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${activeTab === 'catalogo' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Download size={20} /> Exportar Catálogo PDF
          </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-2 px-2 text-xs text-slate-400">
            <User size={14} /> Usuario: <span className="font-semibold text-white">{username}</span>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-rose-400 hover:bg-rose-950/40 py-2.5 rounded-xl text-sm transition">
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-700 md:hidden"><Menu size={24} /></button>
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="h-8 w-auto md:hidden" />
            <h1 className="text-lg font-bold text-slate-900 capitalize">{activeTab}</h1>
            <span className="text-xs text-slate-500 hidden sm:inline">• Inventario Bloom Bazar</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchProducts}
              className="p-1.5 text-slate-500 hover:text-pink-600 transition rounded-lg hover:bg-slate-100"
              title="Recargar datos de Supabase"
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin text-pink-600" : ""} />
            </button>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
              ● Supabase Cloud
            </span>
          </div>
        </header>

        <main className="p-4 md:p-8 flex-1 overflow-y-auto">
          {activeTab === 'productos' && (
            <div className="space-y-6">

              <div className="flex border-b border-slate-200 space-x-2">
                {['Todos', 'Mujer', 'Hombre', 'Niños', 'Otros'].map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setGenderFilter(gender)}
                    className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${genderFilter === gender
                      ? 'border-pink-600 text-pink-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                  <input type="text" placeholder="Buscar por nombre o marca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-pink-400 bg-white text-slate-800" />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={20} className="text-slate-400" />
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="border border-slate-200 rounded-xl py-2.5 px-3 text-sm bg-white text-slate-800">
                    <option value="Todas">Todas las categorías</option>
                    {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              {isLoading && (
                <div className="text-center py-12 text-slate-500 font-medium text-sm">
                  Cargando productos de Bloom Bazar...
                </div>
              )}

              {!isLoading && filteredProducts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                  No hay productos para mostrar en este filtro. Agrega tu primer producto desde la sección de gestión.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(prod => (
                  <div key={prod.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
                    <div className="h-48 bg-slate-100 relative">
                      <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                      <span className="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">{prod.status}</span>
                      <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900/80 text-white backdrop-blur-sm">{prod.gender}</span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-xs uppercase font-bold tracking-wider text-pink-600">{prod.brand}</span>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">{prod.name}</h3>
                        <p className="text-xs text-slate-600 font-medium mb-3">{prod.category}</p>

                        {prod.category === 'Otros' ? (
                          <div className="border-t border-slate-100 pt-3 space-y-2">
                            <p className="text-xs text-slate-600 italic">{prod.description || 'Sin descripción'}</p>
                            <div className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-lg font-bold text-slate-800 border border-slate-100">
                              <span>Precio: ${prod.singlePrice}</span>
                              <span className="text-slate-600 font-normal">{prod.singleStock} disp.</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 border-t border-slate-100 pt-3">
                            <p className="text-xs font-bold text-slate-700">Tallas y Precios:</p>
                            {prod.variants.map((v, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/60">
                                <span className="font-semibold text-slate-800">Talla: {v.size}</span>
                                <span className="text-slate-600 font-medium">{v.stock} disp.</span>
                                <span className="font-bold text-pink-600">${v.price}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gestion' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* FORMULARIO AGREGAR PRODUCTO */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-6">Agregar Nuevo Producto</h2>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre</label>
                      <input type="text" required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ej. Vestido Floreado" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Marca</label>
                      <input type="text" required value={newProduct.brand} onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })} placeholder="Ej. Bloom Bazar / Zara" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Categoría</label>
                      <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800">
                        {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Para (Género)</label>
                      <select value={newProduct.gender} onChange={(e) => setNewProduct({ ...newProduct, gender: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800">
                        <option value="Mujer">Mujer (M)</option>
                        <option value="Hombre">Hombre (H)</option>
                        <option value="Niños">Niños (N)</option>
                        <option value="Todos">Unisex / Todos</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Estado</label>
                      <select value={newProduct.status} onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800">
                        <option value="Nuevo">Nuevo</option>
                        <option value="Usado / Excelente">Usado / Excelente</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Subir Foto a Supabase Storage</label>
                    <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-pink-500 rounded-2xl p-4 cursor-pointer text-slate-600 bg-slate-50 transition">
                      <Upload size={20} className="text-pink-600" />
                      <span className="text-sm font-medium">{selectedFile ? `Foto seleccionada: ${selectedFile.name}` : 'Haz clic para seleccionar foto de tu dispositivo'}</span>
                      <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                    </label>
                  </div>

                  {newProduct.category === 'Otros' ? (
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase mb-1">Descripción del Producto</label>
                        <textarea
                          rows={3}
                          value={newProduct.description}
                          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                          placeholder="Ej. Accesorio de joyería..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Precio $</label>
                          <input type="number" value={newProduct.singlePrice} onChange={(e) => setNewProduct({ ...newProduct, singlePrice: e.target.value })} placeholder="Ej. 150" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Existencias</label>
                          <input type="number" value={newProduct.singleStock} onChange={(e) => setNewProduct({ ...newProduct, singleStock: e.target.value })} placeholder="Ej. 8" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white text-slate-800" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-slate-100 pt-4 mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold text-slate-800 uppercase">Tallas y Existencias</label>
                        <button type="button" onClick={handleAddVariant} className="text-xs text-pink-600 font-semibold flex items-center gap-1 hover:text-pink-800">
                          <Plus size={14} /> Otra Talla
                        </button>
                      </div>

                      {newProduct.variants.map((v, i) => (
                        <div key={i} className="flex gap-2 items-center mb-2">
                          <input type="text" placeholder={newProduct.gender === 'Niños' ? "Ej. 8-10 yrs" : "Talla (S, M)"} value={v.size} onChange={(e) => handleVariantChange(i, 'size', e.target.value)} className="w-1/3 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800" />
                          <input type="number" placeholder="Precio $" value={v.price} onChange={(e) => handleVariantChange(i, 'price', e.target.value)} className="w-1/3 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800" />
                          <input type="number" placeholder="Existencias" value={v.stock} onChange={(e) => handleVariantChange(i, 'stock', e.target.value)} className="w-1/3 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-800" />
                          {newProduct.variants.length > 1 && (
                            <button type="button" onClick={() => handleRemoveVariant(i)} className="text-rose-400 hover:text-rose-600 p-1"><X size={16} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button type="submit" disabled={isLoading} className="w-full bg-pink-600 text-white font-medium py-3 rounded-xl text-sm mt-4 hover:bg-pink-700 transition shadow-md disabled:opacity-50">
                    {isLoading ? 'Guardando en Supabase...' : 'Guardar Producto en Nube'}
                  </button>
                </form>
              </div>

              {/* SECCIÓN EDITAR STOCK / ELIMINAR */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Editar Stock / Eliminar</h2>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {products.map(p => {
                    const totalStock = p.category === 'Otros' ? p.singleStock : p.variants.reduce((acc, curr) => acc + curr.stock, 0);

                    return (
                      <div key={p.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                            <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">{p.category}</span>
                          </div>

                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className={`p-1.5 rounded-lg transition ${totalStock === 0 ? 'text-rose-600 hover:bg-rose-100' : 'text-slate-300 cursor-not-allowed'}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {p.category === 'Otros' ? (
                          <div className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-200">
                            <span className="font-semibold text-slate-700">Stock Total:</span>
                            <input
                              type="number"
                              value={p.singleStock}
                              onChange={(e) => handleUpdateStock(p.id, 0, e.target.value)}
                              className="w-16 px-1 py-0.5 border border-slate-300 rounded-lg text-center text-xs text-slate-800"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {p.variants.map((v, vIdx) => (
                              <div key={vIdx} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-xl border border-slate-200">
                                <span className="font-semibold text-slate-800">Talla: {v.size}</span>
                                <div className="flex items-center gap-1">
                                  <input type="number" value={v.stock} onChange={(e) => handleUpdateStock(p.id, vIdx, e.target.value)} className="w-14 px-1 py-0.5 border border-slate-300 rounded-lg text-center text-xs text-slate-800" />
                                  <button type="button" onClick={() => handleDeleteVariant(p.id, vIdx)} className="text-rose-400 hover:text-rose-600 p-0.5"><X size={14} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'catalogo' && (
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
              <div className="w-16 h-16 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-pink-100">
                <Download size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Descargar Catálogo PDF</h2>
              <p className="text-slate-500 text-sm mt-2 mb-6">Genera tu reporte en PDF seccionado y con la portada oficial de Bloom Bazar.</p>
              <button onClick={downloadPDFCatalog} className="bg-pink-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 mx-auto text-sm hover:bg-pink-700 transition shadow-md">
                <Download size={20} /> Generar y Descargar PDF
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}