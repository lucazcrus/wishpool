import Logo from '../assets/images/Logo.svg'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TopBarProps {
  currentCategory: string
  categories: string[]
  avatarName: string
  onCategoryChange: (category: string) => void
  onLogout?: () => Promise<void> | void
  profilePath?: string
  showBack?: boolean
  homePath?: string
}

function getAvatarInitial(name: string) {
  return (String(name || '').trim()[0] || 'U').toUpperCase()
}

function sanitizeCategories(categories: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const category of categories) {
    const normalized = category.trim()
    if (!normalized) continue
    if (normalized.toLowerCase() === 'todos') continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function TopBar({
  currentCategory,
  categories,
  avatarName,
  onCategoryChange,
  onLogout,
  profilePath = './profile.html',
  homePath = './index.html',
  showBack = false,
}: TopBarProps) {
  const cleanedCategories = sanitizeCategories(categories)
  const hasCategories = cleanedCategories.length > 0
  const allCategories = hasCategories ? ['Todos', ...cleanedCategories] : []

  return (
    <header className="topbar">
      {/* Main row: Logo + (tabs on desktop) + Avatar */}
      <div className="topbar-inner p-4">
        <a href={homePath} aria-label="Ir para o início">
          <img src={Logo} alt="Wishpool" className="h-8 w-auto shrink-0" />
        </a>

        {showBack ? (
          <div className="flex-1">
            <Button variant="secondary" asChild>
              <a href={homePath}>Voltar</a>
            </Button>
          </div>
        ) : !hasCategories ? (
          <div className="flex-1" />
        ) : (
          /* Desktop tabs – hidden on mobile */
          <nav className="hidden md:flex flex-1 gap-5 overflow-hidden" aria-label="Categorias">
            {allCategories.map((category) => (
              <a
                key={category}
                href="#"
                className={`category-link${currentCategory === category ? ' active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  onCategoryChange(category)
                }}
              >
                {category}
              </a>
            ))}
          </nav>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="avatar-link"
              aria-label="Abrir menu do perfil"
            >
              <span className="avatar-badge" aria-hidden="true">
                {getAvatarInitial(avatarName)}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <a href={profilePath}>Perfil & Configurações</a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                disabled={!onLogout}
                onSelect={() => {
                  void onLogout?.()
                }}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile tabs row – hidden on desktop */}
      {!showBack && hasCategories && (
        <div className="md:hidden border-t border-[#eee] overflow-x-auto">
          <nav className="flex gap-4 px-4 py-3 whitespace-nowrap" aria-label="Categorias">
            {allCategories.map((category) => (
              <a
                key={category}
                href="#"
                className={`category-link${currentCategory === category ? ' active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  onCategoryChange(category)
                }}
              >
                {category}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
