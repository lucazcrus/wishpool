export interface Item {
  id: string
  name: string
  category: string
  price: number
  currency?: string
  url: string
  image: string
}

export interface Profile {
  name: string
  email: string
  preferences: Record<string, unknown>
}

export interface AppState {
  items: Item[]
  categories: string[]
  profile: Profile
}
