import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Clock, AlertTriangle } from 'lucide-react';

export const AwaitingApproval: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
                <div className="bg-amber-50 p-6 flex flex-col items-center border-b border-amber-100">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 text-center">Account Pending</h2>
                    <p className="text-amber-700 text-center mt-2 font-medium">Awaiting Administrator Approval</p>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <div className="flex items-start gap-3">
                            <div className="p-1 bg-blue-100 rounded-full mt-0.5">
                                <AlertTriangle className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-blue-900">What happens next?</h3>
                                <p className="text-sm text-blue-800 mt-1">
                                    Your account has been created successfully but requires administrator verification before you can access the system.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2 text-sm text-gray-600">
                            <div className="flex justify-between border-b pb-2">
                                <span>Username:</span>
                                <span className="font-medium text-gray-900">{user?.username}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Role:</span>
                                <span className="font-medium text-gray-900 capitalize">{user?.role}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span>Status:</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                    Pending Review
                                </span>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 text-center leading-relaxed">
                            Please contact your clinic administrator if you believe this is an error or if you need urgent access.
                        </p>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};
