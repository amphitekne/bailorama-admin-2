import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { TaskProvider } from './context/TaskContext'
import { TaskToastContainer } from './components/ui/TaskToastContainer'

export default function App() {
  return (
    <TaskProvider>
      <RouterProvider router={router} />
      <TaskToastContainer />
    </TaskProvider>
  )
}
