'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User, Code, Award, Target, ExternalLink, Plus, X, Calendar,
    Trophy, Star, Zap, CheckCircle
} from 'lucide-react'
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '@/utils/contract'
import { api } from '@/utils/api'
import toast from 'react-hot-toast'

interface Achievement {
    title: string
    description: string
    category: 'hackathon' | 'certification' | 'project' | 'education' | 'work' | 'community'
    dateAchieved: string
    proof?: string
    verified: boolean
}

interface Goal {
    title: string
    description: string
    category: string
    targetDate: string
    priority: 'high' | 'medium' | 'low'
}

interface CreateIdentityProps {
    onIdentityCreated: (identity: any) => void
    isCreating?: boolean
}

export function CreateIdentity({ onIdentityCreated, isCreating = false }: CreateIdentityProps) {
    const [currentStep, setCurrentStep] = useState(1)

    // Basic Info
    const [username, setUsername] = useState('')
    const [primarySkill, setPrimarySkill] = useState('')
    const [experience, setExperience] = useState<'beginner' | 'intermediate' | 'advanced' | 'expert'>('beginner')
    const [bio, setBio] = useState('')

    // Skills
    const [skills, setSkills] = useState<string[]>([])
    const [newSkill, setNewSkill] = useState('')

    // Achievements
    const [achievements, setAchievements] = useState<Achievement[]>([])
    const [newAchievement, setNewAchievement] = useState<Achievement>({
        title: '',
        description: '',
        category: 'project',
        dateAchieved: '',
        proof: '',
        verified: false
    })

    // Goals
    const [goals, setGoals] = useState<Goal[]>([])
    const [newGoal, setNewGoal] = useState<Goal>({
        title: '',
        description: '',
        category: '',
        targetDate: '',
        priority: 'medium'
    })

    // Social Links
    const [socialLinks, setSocialLinks] = useState({
        twitter: '', github: '', linkedin: '', website: ''
    })

    const [loading, setLoading] = useState(false)
    const [pendingIdentityData, setPendingIdentityData] = useState<any>(null)

    const { address, isConnected } = useAccount()
    const { writeContract, data: hash, isPending } = useWriteContract()
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    })

    // Add these hooks for reading contract data
    const { data: hasExistingIdentity } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'hasIdentity',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && !!CONTRACT_ADDRESS
        }
    })

    const { data: isUsernameUsed } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'usedUsernames',
        args: username ? [username.trim()] : undefined,
        query: {
            enabled: !!username && !!CONTRACT_ADDRESS
        }
    })

    // Watch for transaction confirmation to save to database
    useEffect(() => {
        if (isConfirmed && hash && pendingIdentityData) {
            saveToDatabase(pendingIdentityData, hash)
        }
    }, [isConfirmed, hash, pendingIdentityData])

    const addSkill = () => {
        if (newSkill.trim() && !skills.includes(newSkill.trim())) {
            setSkills([...skills, newSkill.trim()])
            setNewSkill('')
        }
    }

    const addAchievement = () => {
        if (newAchievement.title && newAchievement.description) {
            setAchievements([...achievements, { ...newAchievement }])
            setNewAchievement({
                title: '', description: '', category: 'project',
                dateAchieved: '', proof: '', verified: false
            })
        }
    }

    const addGoal = () => {
        if (newGoal.title && newGoal.description) {
            setGoals([...goals, { ...newGoal }])
            setNewGoal({
                title: '', description: '', category: '',
                targetDate: '', priority: 'medium'
            })
        }
    }

    const calculatePrice = () => {
        let price = 10 // Base price
        price += achievements.length * 5 // +5 STT per achievement
        price += goals.length * 2 // +2 STT per goal
        price += skills.length * 1 // +1 STT per skill

        const multipliers = { beginner: 1, intermediate: 1.2, advanced: 1.5, expert: 2 }
        price *= multipliers[experience]

        return Math.round(price * 100) / 100
    }

    const saveToDatabase = async (identityData: any, txHash: string) => {
        try {
            // FIXED: Structure data properly for backend parsing
            const backendData = {
                ...identityData,
                txHash,
                profile: {
                    bio,
                    skills,
                    achievements: achievements.map((a, index) => ({
                        id: `ach_${Date.now()}_${index}`,
                        ...a,
                        points: a.category === 'hackathon' ? 50 : a.category === 'certification' ? 30 : 20,
                        valueImpact: a.category === 'hackathon' ? 15 : 10,
                        dateAchieved: new Date(a.dateAchieved)
                    })),
                    goals: goals.map((g, index) => ({
                        id: `goal_${Date.now()}_${index}`,
                        ...g,
                        targetDate: new Date(g.targetDate),
                        progress: 0,
                        valueImpact: g.priority === 'high' ? 10 : g.priority === 'medium' ? 5 : 2
                    })),
                    socialLinks
                }
            }

            console.log('Sending to backend:', backendData)

            const response = await api.createIdentity(
                username.trim(),
                primarySkill.trim(),
                JSON.stringify(backendData) // Send structured data as bio parameter
            )

            if (response.success) {
                toast.success('SomniaID created successfully!')
                console.log('Backend response:', response)
                onIdentityCreated({
                    ...identityData,
                    txHash,
                    lastUpdate: Date.now()
                })
            } else {
                throw new Error(response.error || 'Failed to save identity')
            }
        } catch (error: any) {
            console.error('Error saving identity:', error)
            toast.error(error?.message || 'Failed to save identity to database')
        } finally {
            setLoading(false)
            setPendingIdentityData(null)
        }
    }

    // Update your handleSubmit function
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!isConnected || !address) {
            toast.error('Please connect your wallet')
            return
        }

        if (!username.trim() || !primarySkill.trim()) {
            toast.error('Please fill in all required fields')
            return
        }

        // Check validations using the hook data
        if (hasExistingIdentity) {
            toast.error('You already have an identity! Each address can only have one identity.')
            return
        }

        if (isUsernameUsed) {
            toast.error('Username is already taken. Please choose a different one.')
            return
        }

        try {
            setLoading(true)

            const tokenId = Math.floor(Date.now() / 1000)
            const estimatedPrice = calculatePrice()

            const identityData = {
                tokenId,
                username,
                primarySkill,
                experience,
                ownerAddress: address,
                reputationScore: 100 + achievements.length * 10,
                skillLevel: experience === 'beginner' ? 1 : experience === 'intermediate' ? 2 : experience === 'advanced' ? 3 : 4,
                achievementCount: achievements.length,
                isVerified: false,
                currentPrice: estimatedPrice,
                profile: {
                    bio,
                    skills,
                    achievements: achievements.map((a, index) => ({
                        id: `ach_${Date.now()}_${index}`,
                        ...a,
                        points: a.category === 'hackathon' ? 50 : a.category === 'certification' ? 30 : 20,
                        valueImpact: a.category === 'hackathon' ? 15 : 10,
                        dateAchieved: new Date(a.dateAchieved)
                    })),
                    goals: goals.map((g, index) => ({
                        id: `goal_${Date.now()}_${index}`,
                        ...g,
                        targetDate: new Date(g.targetDate),
                        progress: 0,
                        valueImpact: g.priority === 'high' ? 10 : g.priority === 'medium' ? 5 : 2
                    })),
                    socialLinks
                }
            }

            setPendingIdentityData(identityData)

            toast.loading('Please confirm the transaction in your wallet...')

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'createIdentity',
                args: [username.trim(), primarySkill.trim()],
            })

        } catch (error: any) {
            console.error('Error in handleSubmit:', error)
            toast.dismiss()

            if (error.message?.includes('Proposal expired')) {
                toast.error('Wallet connection expired. Please reconnect and try again.')
            } else if (error.message?.includes('rejected')) {
                toast.error('Transaction cancelled by user')
            } else {
                toast.error(`Transaction failed: ${error.message || 'Unknown error'}`)
            }

            setLoading(false)
            setPendingIdentityData(null)
        }
    }

    const nextStep = () => setCurrentStep(currentStep + 1)
    const prevStep = () => setCurrentStep(currentStep - 1)

    return (
        <div className="max-w-4xl mx-auto">
            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                    <span>Step {currentStep} of 5</span>
                    <span>{Math.round((currentStep / 5) * 100)}% Complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(currentStep / 5) * 100}%` }}
                    />
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <AnimatePresence mode="wait">
                    {/* Step 1: Basic Info */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-8">
                                <User className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                                <p className="text-gray-600">Tell us about yourself</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username *
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Your unique username"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Primary Skill *
                                    </label>
                                    <select
                                        value={primarySkill}
                                        onChange={(e) => setPrimarySkill(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="">Select primary skill</option>
                                        <option value="Smart Contract Development">Smart Contract Development</option>
                                        <option value="Frontend Development">Frontend Development</option>
                                        <option value="Backend Development">Backend Development</option>
                                        <option value="Blockchain Architecture">Blockchain Architecture</option>
                                        <option value="DeFi Protocol Design">DeFi Protocol Design</option>
                                        <option value="NFT Creation">NFT Creation</option>
                                        <option value="Web3 Security">Web3 Security</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Experience Level *
                                </label>
                                <div className="grid grid-cols-4 gap-3">
                                    {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((level) => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setExperience(level)}
                                            className={`p-3 rounded-lg border-2 text-sm font-medium capitalize ${experience === level
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Bio
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Tell us about yourself..."
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24"
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Skills */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-8">
                                <Code className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900">Skills & Expertise</h2>
                                <p className="text-gray-600">Add your technical skills</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Add Skills
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newSkill}
                                        onChange={(e) => setNewSkill(e.target.value)}
                                        placeholder="Enter a skill"
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                                    />
                                    <button
                                        type="button"
                                        onClick={addSkill}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {skills.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Your Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map((skill, index) => (
                                            <span
                                                key={index}
                                                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                                            >
                                                {skill}
                                                <button
                                                    type="button"
                                                    onClick={() => setSkills(skills.filter((_, i) => i !== index))}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Step 3: Achievements */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-8">
                                <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900">Your Achievements</h2>
                                <p className="text-gray-600">Showcase your accomplishments</p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-4">Add Achievement</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <input
                                        type="text"
                                        value={newAchievement.title}
                                        onChange={(e) => setNewAchievement({ ...newAchievement, title: e.target.value })}
                                        placeholder="Achievement title"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <select
                                        value={newAchievement.category}
                                        onChange={(e) => setNewAchievement({ ...newAchievement, category: e.target.value as any })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="project">Project</option>
                                        <option value="hackathon">Hackathon</option>
                                        <option value="certification">Certification</option>
                                        <option value="education">Education</option>
                                        <option value="work">Work</option>
                                        <option value="community">Community</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <input
                                        type="date"
                                        value={newAchievement.dateAchieved}
                                        onChange={(e) => setNewAchievement({ ...newAchievement, dateAchieved: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="url"
                                        value={newAchievement.proof || ''}
                                        onChange={(e) => setNewAchievement({ ...newAchievement, proof: e.target.value })}
                                        placeholder="Proof URL (optional)"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <textarea
                                    value={newAchievement.description}
                                    onChange={(e) => setNewAchievement({ ...newAchievement, description: e.target.value })}
                                    placeholder="Describe your achievement..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg h-20 mb-4"
                                />
                                <button
                                    type="button"
                                    onClick={addAchievement}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Add Achievement
                                </button>
                            </div>

                            {achievements.length > 0 && (
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Your Achievements ({achievements.length})</h3>
                                    <div className="space-y-3">
                                        {achievements.map((achievement, index) => (
                                            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-gray-900">{achievement.title}</h4>
                                                        <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize">
                                                                {achievement.category}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{achievement.dateAchieved}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAchievements(achievements.filter((_, i) => i !== index))}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Step 4: Goals */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-8">
                                <Target className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900">Goals & Vision</h2>
                                <p className="text-gray-600">What are you working towards?</p>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-4">Add Goal</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <input
                                        type="text"
                                        value={newGoal.title}
                                        onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                                        placeholder="Goal title"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="text"
                                        value={newGoal.category}
                                        onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                                        placeholder="Category (e.g., Career, Learning)"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <input
                                        type="date"
                                        value={newGoal.targetDate}
                                        onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <select
                                        value={newGoal.priority}
                                        onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value as any })}
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="high">High Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="low">Low Priority</option>
                                    </select>
                                </div>
                                <textarea
                                    value={newGoal.description}
                                    onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                                    placeholder="Describe your goal and how you plan to achieve it..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg h-20 mb-4"
                                />
                                <button
                                    type="button"
                                    onClick={addGoal}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    Add Goal
                                </button>
                            </div>

                            {goals.length > 0 && (
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-3">Your Goals ({goals.length})</h3>
                                    <div className="space-y-3">
                                        {goals.map((goal, index) => (
                                            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-gray-900">{goal.title}</h4>
                                                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                                {goal.category}
                                                            </span>
                                                            <span className={`text-xs px-2 py-1 rounded ${goal.priority === 'high' ? 'bg-red-100 text-red-800' :
                                                                goal.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {goal.priority} priority
                                                            </span>
                                                            <span className="text-xs text-gray-500">Target: {goal.targetDate}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setGoals(goals.filter((_, i) => i !== index))}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Step 5: Review */}
                    {currentStep === 5 && (
                        <motion.div
                            key="step5"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-8">
                                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-gray-900">Review & Create</h2>
                                <p className="text-gray-600">Review your profile before creating</p>
                            </div>

                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border">
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Estimated NFT Value</h3>
                                    <div className="text-3xl font-bold text-blue-600">{calculatePrice()} STT</div>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Based on {achievements.length} achievements, {goals.length} goals, and {skills.length} skills
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-4 rounded-lg border">
                                    <h4 className="font-medium text-gray-900 mb-2">Profile Summary</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><strong>Username:</strong> {username}</div>
                                        <div><strong>Primary Skill:</strong> {primarySkill}</div>
                                        <div><strong>Experience:</strong> {experience}</div>
                                        <div><strong>Skills:</strong> {skills.length}</div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border">
                                    <h4 className="font-medium text-gray-900 mb-2">Achievements & Goals</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><strong>Achievements:</strong> {achievements.length}</div>
                                        <div><strong>Goals:</strong> {goals.length}</div>
                                        <div><strong>Hackathons:</strong> {achievements.filter(a => a.category === 'hackathon').length}</div>
                                        <div><strong>Certifications:</strong> {achievements.filter(a => a.category === 'certification').length}</div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Social Links (Optional)
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="url"
                                        value={socialLinks.github}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
                                        placeholder="GitHub URL"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="url"
                                        value={socialLinks.twitter}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                                        placeholder="Twitter URL"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="url"
                                        value={socialLinks.linkedin}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                                        placeholder="LinkedIn URL"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                    <input
                                        type="url"
                                        value={socialLinks.website}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                                        placeholder="Website URL"
                                        className="px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>

                            {/* Debug Test Button */}
                            <button
                                type="button"
                                onClick={() => {
                                    console.log('=== FRONTEND DATA COLLECTION TEST ===')
                                    console.log('1. Username:', username)
                                    console.log('2. Primary Skill:', primarySkill)
                                    console.log('3. Experience:', experience)
                                    console.log('4. Bio:', bio)
                                    console.log('5. Skills:', skills)
                                    console.log('6. Achievements:', achievements)
                                    console.log('7. Goals:', goals)
                                    console.log('8. Social Links:', socialLinks)

                                    const testData = {
                                        username,
                                        primarySkill,
                                        experience,
                                        ownerAddress: address,
                                        profile: {
                                            bio,
                                            skills,
                                            achievements: achievements.map((a, index) => ({
                                                id: `ach_${Date.now()}_${index}`,
                                                ...a,
                                                points: a.category === 'hackathon' ? 50 : a.category === 'certification' ? 30 : 20,
                                                valueImpact: a.category === 'hackathon' ? 15 : 10,
                                                dateAchieved: new Date(a.dateAchieved)
                                            })),
                                            goals: goals.map((g, index) => ({
                                                id: `goal_${Date.now()}_${index}`,
                                                ...g,
                                                targetDate: new Date(g.targetDate),
                                                progress: 0,
                                                valueImpact: g.priority === 'high' ? 10 : g.priority === 'medium' ? 5 : 2
                                            })),
                                            socialLinks
                                        }
                                    }

                                    console.log('9. Structured data that will be sent:', testData)
                                    console.log('10. JSON string length:', JSON.stringify(testData).length)
                                    console.log('=== END TEST ===')

                                    toast.success(`Data collected: ${achievements.length} achievements, ${goals.length} goals, ${skills.length} skills`)
                                }}
                                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mb-4"
                            >
                                🔍 Test Data Collection
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={prevStep}
                        className={`px-6 py-2 border border-gray-300 rounded-lg ${currentStep === 1 ? 'invisible' : ''}`}
                    >
                        Previous
                    </button>

                    {currentStep < 5 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            disabled={currentStep === 1 && (!username || !primarySkill)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading || isPending || isConfirming || !username || !primarySkill}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center space-x-2"
                        >
                            {loading || isPending || isConfirming ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>
                                        {isPending ? 'Confirm in Wallet...' :
                                            isConfirming ? 'Processing Transaction...' :
                                                'Creating...'}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5" />
                                    <span>Create My SomniaID</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}