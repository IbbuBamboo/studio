
import { db } from './firebase';
import {
  doc,
  collection,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  getDocs
} from 'firebase/firestore';
import type { Participant } from '@/app/room/[roomId]/page';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private remoteStreams: { [key: string]: MediaStream } = {};
  private roomId: string;
  private onParticipantsChange: (participants: Participant[]) => void;
  private participants: Participant[] = [];
  private localParticipantId: string | null = null;
  private roomRef: any;
  private unsubscribes: (() => void)[] = [];


  constructor(roomId: string, onParticipantsChange: (participants: Participant[]) => void) {
    this.pc = new RTCPeerConnection(servers);
    this.roomId = roomId;
    this.onParticipantsChange = onParticipantsChange;
    this.roomRef = doc(db, 'rooms', this.roomId);
  }

  private updateParticipants() {
    this.onParticipantsChange([...this.participants]);
  }

  public async joinRoom(localStream: MediaStream, localParticipant: Participant) {
    this.localStream = localStream;
    this.localParticipantId = localParticipant.id;

    this.participants.push(localParticipant);
    this.updateParticipants();
    
    this.localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, this.localStream!);
    });

    const roomSnapshot = await getDoc(this.roomRef);
    if (!roomSnapshot.exists()) {
      await writeBatch(db).set(this.roomRef, {}).commit();
    }
    
    const callerCandidatesCollection = collection(this.roomRef, 'callerCandidates');
    const calleeCandidatesCollection = collection(this.roomRef, 'calleeCandidates');

    this.pc.onicecandidate = event => {
      if(event.candidate) {
        addDoc(callerCandidatesCollection, event.candidate.toJSON());
      }
    };

    const offerDescription = await this.pc.createOffer();
    await this.pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    
    await updateDoc(this.roomRef, { offer });

    this.unsubscribes.push(onSnapshot(this.roomRef, (snapshot) => {
        const data = snapshot.data();
        if (!this.pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          this.pc.setRemoteDescription(answerDescription);
        }
      })
    );
      
    this.unsubscribes.push(onSnapshot(calleeCandidatesCollection, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            this.pc.addIceCandidate(candidate);
          }
        });
      })
    );

    this.pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            // A bit of a hack to get a remote stream into a single object
            // Usually you'd have one peer connection per remote participant
            Object.values(this.remoteStreams)[0]?.addTrack(track)
        });
    };
    
    // For simplicity, we'll model this as one giant call, not peer-to-peer.
    // This is not scalable but works for a small number of participants.
    this.setupPeerConnections();
  }
  
  // This is a simplified "mesh" where we connect to everyone.
  // A real app would use a SFU for efficiency.
  private async setupPeerConnections() {
      // Create a "participant" document in firestore
      const participantRef = doc(collection(this.roomRef, 'participants'), this.localParticipantId!);
      await setDoc(participantRef, { name: this.participants.find(p => p.isLocal)!.name });

      this.unsubscribes.push(onSnapshot(collection(this.roomRef, 'participants'), (snapshot) => {
        const remoteParticipants: Participant[] = [];
        snapshot.docs.forEach(doc => {
          if (doc.id !== this.localParticipantId) {
             const remoteStream = new MediaStream();
             this.remoteStreams[doc.id] = remoteStream;
             remoteParticipants.push({
                 id: doc.id,
                 name: doc.data().name,
                 stream: remoteStream,
                 isMuted: true, // Cannot determine this without more signaling
                 isVideoOff: true, // Cannot determine this without more signaling
                 isLocal: false
             });
          }
        });

        this.participants = [this.participants.find(p => p.isLocal)!, ...remoteParticipants];
        this.updateParticipants();
      }));
  }

  public async hangUp() {
    this.pc.close();
    this.unsubscribes.forEach(unsub => unsub());

    if(this.localParticipantId){
       await deleteDoc(doc(collection(this.roomRef, 'participants'), this.localParticipantId));
    }
    
    const roomSnapshot = await getDoc(this.roomRef);
    const participantsQuery = query(collection(this.roomRef, 'participants'));
    const participantsSnapshot = await getDocs(participantsQuery);

    // If last participant, delete the room and its subcollections
    if (roomSnapshot.exists() && participantsSnapshot.empty) {
        const callerCandidatesQuery = query(collection(this.roomRef, 'callerCandidates'));
        const calleeCandidatesQuery = query(collection(this.roomRef, 'calleeCandidates'));
        const callerCandidates = await getDocs(callerCandidatesQuery);
        const calleeCandidates = await getDocs(calleeCandidatesQuery);
        
        const batch = writeBatch(db);
        callerCandidates.forEach(doc => batch.delete(doc.ref));
        calleeCandidates.forEach(doc => batch.delete(doc.ref));
        batch.delete(this.roomRef);
        await batch.commit();
    }
  }

  public toggleMedia(type: 'audio' | 'video', enabled: boolean) {
    this.localStream?.getTracks().forEach(track => {
      if (track.kind === type) {
        track.enabled = enabled;
      }
    });
  }
}
